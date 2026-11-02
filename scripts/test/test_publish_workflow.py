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
import shutil
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
        # The wait ends at 08:00 whatever the setup took, so the budget is the
        # time from the earliest real start (05:00 KST) to 08:00, plus every step
        # after the wait in their actual order.
        longest_wait = wait('2026-11-02', kst('2026-11-02 05:00'))[0] / 60
        self.assertEqual(decide('push', kst('2026-11-02 05:00'))['test'], 'false')
        verify = STEPS['Verify article URLs']['run']
        tries = int(re.search(r'seq 1 (\d+)', verify).group(1))
        pause = int(re.search(r'sleep (\d+)', verify).group(1))
        after_wait = {
            'final re-check (fetch, decrypt, build)': 2,
            'configure + upload pages': 2,
            'deploy-pages (its own default timeout)': 10,
            'verify URLs (each URL on its last try)': MAX_STORIES * tries * pause / 60,
            'send email + delivery log push': 3,
        }
        need = longest_wait + sum(after_wait.values())
        self.assertGreaterEqual(JOB['timeout-minutes'], need,
                                f'timeout {JOB["timeout-minutes"]} min < {need:.0f} min: wait {longest_wait:.0f} + {after_wait}')
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


FINAL = 'Re-check the latest main before publishing'
D = '2026-11-03'


def sub_exprs(script, exprs, name):
    def sub(m):
        key = m.group(1).strip()
        if key not in exprs:
            raise KeyError(f'unmapped expression in {name}: {key}')
        return exprs[key]
    return re.sub(r'\$\{\{(.*?)\}\}', sub, script)


def git(cwd, *args):
    subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True, text=True,
                   env={**os.environ, 'GIT_AUTHOR_NAME': 't', 'GIT_AUTHOR_EMAIL': 't@t', 'GIT_COMMITTER_NAME': 't', 'GIT_COMMITTER_EMAIL': 't@t'})


STUB_NPX = r"""#!/bin/sh
# Stub for npx in workflow tests: never sends mail, never decrypts.
echo "$*" >> "$NPX_LOG"
case "$*" in
  *send-mail.ts*) echo SENT >> "$SEND_LOG"; echo "stub: not sent"; exit 0;;
  *prepare.ts*)
    d=""; prev=""; for a in "$@"; do [ "$prev" = --date ] && d="$a"; prev="$a"; done
    echo "sealed-seen=$(cat ../sealed-editions/$d.sealed.json 2>/dev/null)" >> "$NPX_LOG"
    # Same contract as scripts/prepare.ts (tested in web/test/prepare.test.ts).
    if echo "$*" | grep -q -- '--delivery' && [ -f "../delivery/$d.skip.json" ]; then echo ready=false; echo skipped=true; echo "reason=cancelled"; exit 0; fi
    if [ ! -f "../sealed-editions/$d.sealed.json" ]; then echo ready=false; echo "reason=no edition"; exit 0; fi
    if [ "$(cat ../sealed-editions/$d.sealed.json)" = broken ]; then echo ready=false; echo "reason=cannot decrypt"; exit 0; fi
    echo ready=true; echo "edition=$PWD/ed.json"; echo "slugs=a b"; echo "reason=built"; exit 0;;
esac
exit 0
"""


class Remote:
    """A bare 'origin' with main, and runner checkouts taken at a given moment."""
    def __init__(self, tmp):
        self.tmp = tmp
        self.origin = os.path.join(tmp, 'origin.git')
        git(tmp, 'init', '-q', '--bare', '-b', 'main', self.origin)
        seed = os.path.join(tmp, 'seed'); git(tmp, 'clone', '-q', self.origin, seed)
        for d in ('web', 'sealed-editions', 'delivery'):
            os.makedirs(os.path.join(seed, d), exist_ok=True)
            open(os.path.join(seed, d, '.keep'), 'w').close()
        with open(os.path.join(seed, 'sealed-editions', f'{D}.sealed.json'), 'w') as f:
            f.write('v1')
        git(seed, 'add', '-A'); git(seed, 'commit', '-qm', 'edition v1'); git(seed, 'push', '-q', 'origin', 'main')
        self.n = 0

    def checkout(self):
        """Like actions/checkout at trigger time: branch main tracking origin/main."""
        self.n += 1
        w = os.path.join(self.tmp, f'run{self.n}'); git(self.tmp, 'clone', '-q', self.origin, w)
        return w

    def push(self, path, content):
        """The editor (or another run) changes main after this run started."""
        c = os.path.join(self.tmp, f'editor{self.n}-{path.replace("/", "_")}'); git(self.tmp, 'clone', '-q', self.origin, c)
        with open(os.path.join(c, path), 'w') as f:
            f.write(content)
        git(c, 'add', '-A'); git(c, 'commit', '-qm', f'change {path}'); git(c, 'push', '-q', 'origin', 'main')


def run_in(work, name, exprs, logs):
    step = STEPS[name]
    script = sub_exprs(step['run'], exprs, name)
    bin_ = os.path.join(work, '.stub-bin'); os.makedirs(bin_, exist_ok=True)
    with open(os.path.join(bin_, 'npx'), 'w') as f:
        f.write(STUB_NPX)
    os.chmod(os.path.join(bin_, 'npx'), 0o755)
    out = os.path.join(work, '.out'); open(out, 'w').close()
    env = {'PATH': f'{bin_}:/usr/bin:/bin', 'GITHUB_OUTPUT': out, 'RUNNER_TEMP': os.path.join(work, '.tmp'),
           'NPX_LOG': logs['npx'], 'SEND_LOG': logs['send'], 'BASE_URL': 'https://example.invalid/', 'HOME': work,
           'GIT_AUTHOR_NAME': 't', 'GIT_AUTHOR_EMAIL': 't@t', 'GIT_COMMITTER_NAME': 't', 'GIT_COMMITTER_EMAIL': 't@t'}
    cwd = os.path.join(work, step.get('working-directory', '.'))
    r = subprocess.run(['bash', '-e', '-c', script], cwd=cwd, env=env, capture_output=True, text=True)
    with open(out) as f:
        outs = dict(l.split('=', 1) for l in f.read().split('\n') if '=' in l)
    return r, outs


class LatestStateTest(unittest.TestCase):
    """The run fixes nothing at trigger time: just before deploy and send it reads the remote main."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        self.remote = Remote(self.tmp)
        self.logs = {'npx': os.path.join(self.tmp, 'npx.log'), 'send': os.path.join(self.tmp, 'send.log')}
        for p in self.logs.values():
            open(p, 'w').close()

    def final(self, work, test=False):
        self.assertIn(FINAL, STEPS, f'missing step "{FINAL}"')
        return run_in(work, FINAL, {'steps.decide.outputs.date': D, 'steps.decide.outputs.test': 'true' if test else 'false'}, self.logs)

    def send(self, work):
        return run_in(work, 'Send email', {'steps.decide.outputs.date': D, 'steps.decide.outputs.test': 'false',
                                           'steps.final.outputs.edition': '/x/ed.json', 'github.run_id': '1'}, self.logs)

    def read(self, k):
        with open(self.logs[k]) as f:
            return f.read()

    def test_correction_during_wait_is_used(self):
        w = self.remote.checkout()
        self.remote.push(f'sealed-editions/{D}.sealed.json', 'v2')   # correction at 07:00
        r, o = self.final(w)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(o.get('ready'), 'true')
        self.assertIn('sealed-seen=v2', self.read('npx'))
        self.assertNotIn('sealed-seen=v1', self.read('npx'))

    def test_cancel_during_wait_blocks_publication(self):
        w = self.remote.checkout()
        self.remote.push(f'delivery/{D}.skip.json', '{"date":"%s","reason":"x"}' % D)
        r, o = self.final(w)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotEqual(o.get('ready'), 'true')
        self.assertEqual(o.get('skipped'), 'true')
        self.assertIn('--delivery', self.read('npx'))

    def test_broken_correction_is_not_published(self):
        w = self.remote.checkout()
        self.remote.push(f'sealed-editions/{D}.sealed.json', 'broken')
        r, o = self.final(w)
        self.assertNotEqual(o.get('ready'), 'true')
        self.assertIn('decrypt', o.get('reason', ''))

    def test_sent_by_another_run_stops_before_deploy(self):
        w = self.remote.checkout()
        self.remote.push(f'delivery/{D}.sent.json', '{}')
        r, o = self.final(w)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(o.get('already'), 'true')
        self.assertNotEqual(o.get('ready'), 'true')
        self.assertNotIn('prepare.ts', self.read('npx'))

    def test_two_runs_send_once(self):
        a, b = self.remote.checkout(), self.remote.checkout()   # both started from the same commit
        r1, _ = self.send(a)
        self.assertEqual(r1.returncode, 0, r1.stderr)
        r2, _ = self.send(b)
        self.assertEqual(r2.returncode, 0, r2.stderr)
        self.assertIn('already sent', r2.stdout)
        self.assertEqual(self.read('send').count('SENT'), 1)

    def test_final_then_send_path(self):
        """Full post-wait path on one checkout: refresh, then send (stubbed) once."""
        w = self.remote.checkout()
        r, o = self.final(w)
        self.assertEqual(o.get('ready'), 'true', r.stderr)
        r2, _ = self.send(w)
        self.assertEqual(r2.returncode, 0, r2.stderr)
        self.assertEqual(self.read('send').count('SENT'), 1)


class GatingTest(unittest.TestCase):
    def test_publish_steps_use_the_final_check(self):
        steps = JOB['steps']
        idx = {s.get('name') or s.get('uses'): i for i, s in enumerate(steps)}
        self.assertIn(FINAL, idx)
        self.assertLess(idx['Wait until 08:00 KST'], idx[FINAL], 'final check must run after the wait')
        for s in steps[idx[FINAL] + 1:]:
            key = s.get('name') or s.get('uses')
            if key == 'Alert on failure':
                continue
            if 'run' in s or 'uses' in s:
                text = yaml.safe_dump(s)
                if key.startswith('Stop when the latest'):
                    continue
                self.assertIn("steps.final.outputs.ready == 'true'", s.get('if', ''), key)
                self.assertNotIn('steps.prep.outputs.edition', text, key)
                self.assertNotIn('steps.prep.outputs.slugs', text, key)
        upload = next(s for s in steps if str(s.get('uses', '')).startswith('actions/upload-pages-artifact'))
        self.assertIn('final', upload['with']['path'])

    def test_prepare_consults_cancellation(self):
        self.assertIn('--delivery ../delivery', STEPS['Prepare (decrypt, validate, build)']['run'])

    def test_invalid_latest_fails_and_alerts_but_cancel_and_sent_do_not(self):
        stop = next(s for s in JOB['steps'] if str(s.get('name', '')).startswith('Stop when the latest'))
        cond = stop['if']
        self.assertIn("steps.final.outputs.ready != 'true'", cond)
        self.assertIn("steps.final.outputs.already != 'true'", cond)
        self.assertIn("steps.final.outputs.skipped != 'true'", cond)
        self.assertIn('exit 1', stop['run'])
        self.assertIn('failure()', STEPS['Alert on failure']['if'])

if __name__ == '__main__':
    unittest.main(verbosity=2)
