"""Tests for .claude/hooks/guard_rm.py.  Run: python3 -I -m unittest scripts/test/test_guard_rm.py"""
import importlib.util
import json
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.normpath(os.path.join(HERE, "..", "..", ".claude", "hooks", "guard_rm.py"))
spec = importlib.util.spec_from_file_location("guard_rm", HOOK)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

HOME = "/home/claude"
BLOCK = [
    # the exact incident command
    "cd references && sed -i 's/a/b/' analysis/deep_reads.json && S=/tmp/x; rm -f $S/*",
    "rm -f $S/*",
    'rm -rf "$DIR"',
    "rm -rf ${DIR}/build",
    "rm -rf $(cat list.txt)",
    "rm -rf `pwd`/x",
    "rm -rf /",
    "rm -rf /*",
    "rm -rf --no-preserve-root /",
    "sudo rm -rf /usr",
    "rm -rf ~",
    "rm -rf ~/*",
    "rm -rf /home",
    "rm -rf /home/claude",
    "rm -rf /tmp/../",
    "find / -name x -delete",
    "find $D -delete",
    "make build && echo ok; rm -rf dist",
    "a=1\nrm -rf $a/",
    "bash -c 'rm -rf $X'",
]
ALLOW = [
    "rm -f dist/app.js",
    "rm -rf /home/claude/generalist-daily/web/dist",
    'rm -rf "${OUT:?OUT not set}/cache"',
    "ls -la $HOME",
    "echo $S; ls /",
    "git rm --cached file.txt && git status",
    "npm test && npm run build",
    "find . -name '*.tmp' -print",
]


class GuardTests(unittest.TestCase):
    def test_blocks(self):
        for c in BLOCK:
            with self.subTest(c=c):
                self.assertIsNotNone(guard.check(c, home=HOME), c)

    def test_allows(self):
        for c in ALLOW:
            with self.subTest(c=c):
                self.assertIsNone(guard.check(c, home=HOME), c)

    def test_hook_protocol_exit_code(self):
        payload = json.dumps({"tool_name": "Bash", "tool_input": {"command": "rm -f $S/*"}})
        r = subprocess.run([sys.executable, "-I", HOOK], input=payload, capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)
        self.assertIn("Blocked", r.stderr)
        ok = json.dumps({"tool_name": "Bash", "tool_input": {"command": "ls"}})
        self.assertEqual(subprocess.run([sys.executable, "-I", HOOK], input=ok, capture_output=True, text=True).returncode, 0)
        other = json.dumps({"tool_name": "Read", "tool_input": {"file_path": "/"}})
        self.assertEqual(subprocess.run([sys.executable, "-I", HOOK], input=other, capture_output=True, text=True).returncode, 0)


if __name__ == "__main__":
    unittest.main()
