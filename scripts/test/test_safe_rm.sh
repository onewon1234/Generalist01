#!/usr/bin/env bash
# Tests for scripts/safe-rm.sh. Uses a throwaway sandbox under mktemp; never touches real paths.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SAFE="$HERE/../safe-rm.sh"
SB="$(mktemp -d)"
mkdir -p "$SB/proj/build" "$SB/outside"; touch "$SB/proj/build/a" "$SB/outside/keep"
fail=0
expect() { # expect <exit-code> <description> -- cmd...
  local want="$1" desc="$2"; shift 3
  "$@" >/dev/null 2>&1; local got=$?
  if [ "$got" -eq "$want" ]; then echo "ok   $desc"; else echo "FAIL $desc (got $got, want $want)"; fail=1; fi
}
EMPTY=""
expect 2 "no SAFE_RM_ROOT"            -- env -u SAFE_RM_ROOT bash "$SAFE" "$SB/proj/build"
expect 2 "SAFE_RM_ROOT=/"             -- env SAFE_RM_ROOT=/ bash "$SAFE" "$SB/proj/build"
expect 2 "empty variable as target"   -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" "$EMPTY"
expect 2 "root target"                -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" /
expect 2 "empty var + /* (incident)"  -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" "$EMPTY/"
expect 2 "outside root"               -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" "$SB/outside/keep"
expect 2 "dot-dot escape"             -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" "$SB/proj/../outside"
expect 2 "root itself"                -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" "$SB/proj"
expect 2 "no args"                    -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE"
expect 2 "all-or-nothing on bad arg"  -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" "$SB/proj/build" /
[ -e "$SB/proj/build/a" ] && echo "ok   nothing deleted after refusal" || { echo "FAIL build deleted after refusal"; fail=1; }
expect 0 "valid delete inside root"   -- env SAFE_RM_ROOT="$SB/proj" bash "$SAFE" "$SB/proj/build"
[ ! -e "$SB/proj/build" ] && echo "ok   build removed" || { echo "FAIL build still present"; fail=1; }
[ -e "$SB/outside/keep" ] && echo "ok   outside untouched" || { echo "FAIL outside deleted"; fail=1; }
rm -rf -- "${SB:?}"
exit "$fail"
