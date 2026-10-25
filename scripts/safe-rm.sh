#!/usr/bin/env bash
# safe-rm.sh — delete files only inside an explicitly allowed root.
#
#   SAFE_RM_ROOT=/path/to/project scripts/safe-rm.sh path [path ...]
#
# Refuses (exit 2, nothing deleted) when:
#   - SAFE_RM_ROOT is unset/empty, is /, or is a top-level directory
#   - no path, or any path is empty
#   - any path resolves to /, a top-level directory, $HOME, or SAFE_RM_ROOT itself
#   - any path resolves outside SAFE_RM_ROOT (symlinks resolved)
# All paths are checked before anything is deleted (all-or-nothing).
set -euo pipefail

die() { echo "safe-rm: $*" >&2; exit 2; }

root_in="${SAFE_RM_ROOT:-}"
[ -n "$root_in" ] || die "SAFE_RM_ROOT is not set"
root="$(realpath -m -- "$root_in")"
depth="$(printf '%s' "$root" | tr -cd '/' | wc -c)"
{ [ "$root" != "/" ] && [ "$depth" -ge 2 ]; } || die "SAFE_RM_ROOT '$root' is / or a top-level directory"

[ "$#" -gt 0 ] || die "no paths given"

targets=()
for p in "$@"; do
  [ -n "$p" ] || die "empty path argument (an unset variable?)"
  t="$(realpath -m -- "$p")"
  tdepth="$(printf '%s' "$t" | tr -cd '/' | wc -c)"
  [ "$t" != "/" ] && [ "$tdepth" -ge 2 ] || die "refusing '$p' -> '$t' (root or top-level directory)"
  [ "$t" != "$(realpath -m -- "${HOME:-/nonexistent}")" ] || die "refusing '$p' -> home directory"
  [ "$t" != "$root" ] || die "refusing '$p' -> SAFE_RM_ROOT itself"
  case "$t/" in
    "$root"/*) ;;
    *) die "refusing '$p' -> '$t' is outside SAFE_RM_ROOT ($root)" ;;
  esac
  targets+=("$t")
done

rm -rf -- "${targets[@]}"
printf 'safe-rm: removed %s\n' "${targets[@]}"
