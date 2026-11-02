#!/usr/bin/env python3
"""Regression tests for .github/workflows/publish.yml (no network, no email).

Runs the workflow's own `Decide` and `Wait until 08:00 KST` shell code with a
fake clock and a stubbed `sleep`, and checks the job timeout covers the longest
wait plus the URL verification loop. Background: the push runs of 10-31, 11-01
and 11-02 were killed mid-wait by `timeout-minutes: 60`, and the scheduled
fallbacks start about three hours late, so the push run must survive the wait.

    python3 -I scripts/test/test_publish_workflow.py
"""
import os
import re
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WF = yaml.safe_load(open(os.path.join(ROOT, '.github', 'workflows', 'publish.yml'), encoding='utf8'))
JOB = WF['jobs']['publish']
STEPS = {s.get('name'): s for s in JOB['steps'] if s.get('name')}
KST = timezone(timedelta(hours=9))
MAX_STORIES = 7  # CLAUDE.md: 5–7 main stories


def kst(s):
    return int(datetime.strptime(s, '%Y-%m-%d %H:%M').replace(tzinfo=KST).timestamp())


def run_step(name, exprs, now, files=()):
    """Run one step's shell with ${{ }} replaced, a fake `date` and a stub `sleep`.
    Returns (outputs dict, stdout, slept seconds list)."""
    script = STEPS[name]['run']
    def sub(m):
        key = m.group(1).strip()
        if key not in exprs:
            raise KeyError(f'unmapped expression in {name}: {key}')
        return exprs[key]
    script = re.sub(r'\$\{\{(.*?)\}\}', sub, script)
    with tempfile.TemporaryDirectory() as d:
        bin_ = os.path.join(d, 'bin'); os.mkdir(bin_)
        real_date = subprocess.run(['sh', '-c', 'command -v date'], capture_output=True, text=True).stdout.strip()
        # Fake clock: `date -d <time>` (an explicit target) passes through; any
        # other call reads the fake "now". Enough for the Decide and Wait steps.
        with open(os.path.join(bin_, 'date'), 'w') as f:
            f.write(f'#!/bin/sh\nfor a in "$@"; do [ "$a" = -d ] && exec {real_date} "$@"; done\nexec {real_date} -d "@$FAKE_NOW" "$@"\n')
        with open(os.path.join(bin_, 'sleep'), 'w') as f:
            f.write('#!/bin/sh\necho "$1" >> "$SLEEP_LOG"\n')
        for p in os.listdir(bin_):
            os.chmod(os.path.join(bin_, p), 0o755)
        work = os.path.join(d, 'work'); os.makedirs(os.path.join(work, 'delivery'))
        for f in files:
            with open(os.path.join(work, f), 'w') as fh:
                fh.write('{}')
        out_file, sleep_log = os.path.join(d, 'out'), os.path.join(d, 'sleep')
        open(sleep_log, 'w').close()
        env = {'PATH': f'{bin_}:/usr/bin:/bin', 'FAKE_NOW': str(now), 'GITHUB_OUTPUT': out_file, 'SLEEP_LOG': sleep_log}
        r = subprocess.run(['bash', '-e', '-c', script], cwd=work, env=env, capture_output=True, text=True)
        if r.returncode:
            raise AssertionError(f'{name} failed: {r.stderr}')
        outs = {}
        if os.path.exists(out_file):
            with open(out_file) as f:
                outs = dict(l.split('=', 1) for l in f.read().split('\n') if '=' in l)
        with open(sleep_log) as f:
            slept = [int(x) for x in f.read().split()]
        return outs, r.stdout, slept


def decide(event, now, date='', test=False, files=()):
    return run_step('Decide', {
        'inputs.date': date,
        "inputs.test && 'true' || 'false'": 'true' if test else 'false',
        'github.event_name': event,
    }, now, files)[0]


def wait(date, now):
    return run_step('Wait until 08:00 KST', {'steps.decide.outputs.date': date}, now)[2]


class DecideTest(unittest.TestCase):
    def test_morning_push_is_real(self):
        o = decide('push', kst('2026-11-02 06:14'))
        self.assertEqual((o['date'], o['test'], o['already']), ('2026-11-02', 'false', 'false'))

    def test_push_outside_window_is_rehearsal(self):
        for t in ('2026-11-02 04:59', '2026-11-02 12:00', '2026-11-02 23:30'):
            self.assertEqual(decide('push', kst(t))['test'], 'true', t)

    def test_already_sent_is_skipped(self):
        o = decide('schedule', kst('2026-11-02 11:08'), files=['delivery/2026-11-02.sent.json'])
        self.assertEqual(o['already'], 'true')

    def test_not_sent_schedule_publishes(self):
        o = decide('schedule', kst('2026-11-02 11:08'))
        self.assertEqual((o['test'], o['already']), ('false', 'false'))

    def test_test_dispatch_ignores_delivery_log(self):
        o = decide('workflow_dispatch', kst('2026-11-02 14:00'), date='2026-11-02', test=True,
                   files=['delivery/2026-11-02.sent.json'])
        self.assertEqual((o['test'], o['already']), ('true', 'false'))


class WaitTest(unittest.TestCase):
    def test_waits_until_0800_kst(self):
        self.assertEqual(wait('2026-11-02', kst('2026-11-02 06:14')), [kst('2026-11-02 08:00') - kst('2026-11-02 06:14')])

    def test_no_wait_after_0800(self):
        self.assertEqual(wait('2026-11-02', kst('2026-11-02 08:01')), [])

    def test_wait_only_for_real_runs(self):
        cond = STEPS['Wait until 08:00 KST']['if']
        self.assertIn("steps.decide.outputs.test != 'true'", cond)
        self.assertIn("steps.prep.outputs.ready == 'true'", cond)


class TimeoutBudgetTest(unittest.TestCase):
    def test_job_timeout_covers_longest_wait_and_verification(self):
        # Longest real wait: a push at the start of the morning window (05:00 KST).
        longest_wait = wait('2026-11-02', kst('2026-11-02 05:00'))[0] / 60
        self.assertEqual(decide('push', kst('2026-11-02 05:00'))['test'], 'false')
        verify = STEPS['Verify article URLs']['run']
        tries = int(re.search(r'seq 1 (\d+)', verify).group(1))
        pause = int(re.search(r'sleep (\d+)', verify).group(1))
        verify_max = MAX_STORIES * tries * pause / 60
        setup_deploy_mail = 10
        need = longest_wait + verify_max + setup_deploy_mail
        self.assertGreaterEqual(JOB['timeout-minutes'], need,
                                f'timeout {JOB["timeout-minutes"]} min < {need:.0f} min (wait {longest_wait:.0f} + verify {verify_max:.0f} + {setup_deploy_mail})')
        self.assertLessEqual(JOB['timeout-minutes'], 360, 'GitHub-hosted job limit is 6 h')


class PolicyTest(unittest.TestCase):
    def test_no_cancel_in_progress(self):
        self.assertFalse(WF['concurrency']['cancel-in-progress'])

    def test_send_guard_and_alerts_kept(self):
        send = STEPS['Send email']['run']
        self.assertIn('delivery/$D.sent.json', send)
        self.assertIn('already sent', send)
        self.assertIn('Alert when there is no valid edition', STEPS)
        self.assertIn('failure()', STEPS['Alert on failure']['if'])

    def test_fallback_schedules_kept(self):
        on = WF.get('on', WF.get(True))
        self.assertGreaterEqual(len(on['schedule']), 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
