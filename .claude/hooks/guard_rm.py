#!/usr/bin/env python3
"""PreToolUse guard for Bash: refuse destructive deletes that could hit / or an
unintended path.

Why this exists (2026-10-25 incident): the command
    cd references && sed -i ... analysis/deep_reads.json && S=/some/dir; rm -f $S/*
failed at `sed`, so the `&&` chain stopped before `S=` was assigned, but the `;`
still ran `rm -f $S/*` with S empty, i.e. `rm -f /*`. That removed the root
symlinks (/bin, /lib, /lib64, /sbin) and broke every program in the workspace.

Rules (any match blocks the command, exit code 2):
  1. A delete command (rm, rmdir, unlink, shred, `find ... -delete`, xargs rm)
     whose arguments use a shell variable or command substitution, unless every
     expansion uses the fail-if-empty form ${NAME:?message}.
  2. A delete target that normalises to /, a top-level directory (/usr, /home, ...),
     or the home directory, or that is a bare root glob such as /* or ~/*.
  3. `--no-preserve-root`.
  4. A delete that runs after `;` or a newline that follows an `&&` chain:
     the pattern that turned a failed step into an unconditional delete.

Use scripts/safe-rm.sh for deliberate deletes; it validates paths first.
"""
import json
import os
import re
import shlex
import sys

DELETE_CMDS = {"rm", "rmdir", "unlink", "shred"}
WRAPPERS = {"sudo", "command", "builtin", "nice", "nohup", "time", "env", "xargs"}
SAFE_EXPANSION = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*:\?[^}]*\}")
# `$(` is split by the tokenizer into "$" and "(", so a bare trailing "$" also counts.
ANY_EXPANSION = re.compile(r"\$[A-Za-z_{(@*#?0-9]|`|\$$")
OPERATORS = {";", "&&", "||", "|", "&", "\n", "(", ")"}


def segments(command):
    """Split a command line into (separator_before, tokens) pairs, keeping raw text."""
    lex = shlex.shlex(command.replace("\n", " ; "), posix=True, punctuation_chars=";&|()")
    lex.whitespace_split = True
    out, cur, sep = [], [], None
    try:
        for tok in lex:
            if tok in OPERATORS or set(tok) <= set(";&|()"):
                out.append((sep, cur))
                cur, sep = [], tok
            else:
                cur.append(tok)
    except ValueError:
        # Unbalanced quotes: treat the whole command as one segment of raw words.
        return [(None, command.split())]
    out.append((sep, cur))
    return [(s, t) for s, t in out if t]


def delete_args(tokens):
    """Return delete-target arguments if this segment deletes files, else None."""
    i = 0
    while i < len(tokens) and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[i]) or tokens[i] in WRAPPERS):
        i += 1
    if i >= len(tokens):
        return None
    head = os.path.basename(tokens[i])
    rest = tokens[i + 1:]
    if head in DELETE_CMDS:
        return [a for a in rest if not a.startswith("-") or a == "--no-preserve-root"]
    if head == "find" and ("-delete" in rest or any(a in ("rm", "/bin/rm") for a in rest)):
        return [a for a in rest if not a.startswith("-")][:1]
    return None


def dangerous_target(arg, home):
    if arg == "--no-preserve-root":
        return "--no-preserve-root"
    a = arg.strip()
    if a in ("", "/", "/*", "/.*", "~", "~/", "~/*", "*", ".*"):
        return f"target '{arg}' is a root, home or bare glob"
    expanded = os.path.expanduser(a)
    stripped = re.sub(r"(/\*|/\.\*|/\.)+$", "", expanded) or "/"
    norm = os.path.normpath(stripped) if stripped.startswith("/") else None
    if norm is not None:
        depth = len([p for p in norm.split("/") if p])
        if norm == "/" or depth <= 1:
            return f"target '{arg}' resolves to '{norm}' (root or top-level directory)"
        if home and norm == os.path.normpath(home):
            return f"target '{arg}' is the home directory"
    return None


def check(command, home=None):
    """Return a reason string if the command must be blocked, else None."""
    home = home if home is not None else os.path.expanduser("~")
    segs = segments(command)
    seen_and_chain = False
    raw = command
    for sep, toks in segs:
        if sep == "&&":
            seen_and_chain = True
        args = delete_args(toks)
        if args is None:
            continue
        # Rule 1: expansions in a delete. Inspect raw text of this command for the args.
        for a in args:
            if ANY_EXPANSION.search(a):
                leftover = SAFE_EXPANSION.sub("", a)
                if ANY_EXPANSION.search(leftover):
                    return (f"delete argument '{a}' uses a variable or substitution without "
                            "${VAR:?}; an empty value could turn it into '/'. Use "
                            "scripts/safe-rm.sh or ${VAR:?not set}.")
        # Rule 2/3: dangerous literal targets.
        for a in args:
            why = dangerous_target(a, home)
            if why:
                return why
        # Rule 4: delete after ';' that follows an && chain.
        if sep == ";" and seen_and_chain:
            return ("delete runs after ';' following an '&&' chain, so it would still run "
                    "if an earlier step failed. Chain it with '&&' or run it separately.")
    # shlex already expanded nothing; also catch `rm` hidden behind eval / bash -c.
    if re.search(r"\b(eval|bash\s+-c|sh\s+-c)\b.*\brm\b", raw) and ANY_EXPANSION.search(raw):
        return "rm inside eval/bash -c with expansions is not allowed; run it directly."
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    if data.get("tool_name") != "Bash":
        return 0
    cmd = (data.get("tool_input") or {}).get("command") or ""
    reason = check(cmd)
    if reason:
        print(f"Blocked by .claude/hooks/guard_rm.py: {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
