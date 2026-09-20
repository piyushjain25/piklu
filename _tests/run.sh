#!/usr/bin/env bash
# Runs the offline test suite. Exits non-zero if any suite fails.
#
#   ./_tests/run.sh            everything
#   ./_tests/run.sh site       only _tests/site/*.test.js (after touching games.js or assets/)
#   ./_tests/run.sh <slug>     _tests/site/* PLUS _tests/games/<slug>/* (the loop while building a game)
#
#   STRESS=quick|deep in front of any of these scales the random-sample counts of the
#   generative tests (~2% / 5x); the full counts run by default.
#   JOBS=n runs n suites at once (default: half the cores). JOBS=1 is the old serial run.
set -uo pipefail
self="$0"
cd "$(dirname "$0")"

usage() { sed -n '4,10p' "$(basename "$self")" | sed 's/^# \{0,1\}//'; }

if [ $# -gt 1 ]; then usage; exit 2; fi
sel="${1:-all}"
case "$sel" in -h|--help) usage; exit 0 ;; esac

stress="${STRESS:-full}"
case "$stress" in
  quick) mode="STRESS=quick — reduced iterations" ;;
  full)  mode="full iterations" ;;
  deep)  mode="STRESS=deep — 5x iterations" ;;
  *) echo "STRESS must be quick, full or deep (got '$stress')" >&2; exit 2 ;;
esac

# The site tests are the shared surface: they run on every invocation, because a new game
# always edits games.js and often assets/ — the edits that break OTHER games.
tests=()
while IFS= read -r t; do tests+=("$t"); done < <(find ./site -name '*.test.js' | sort)
case "$sel" in
  all)
    while IFS= read -r t; do tests+=("$t"); done < <(find ./games -name '*.test.js' | sort) ;;
  site) ;;
  *)
    if [ -d "./games/$sel" ]; then
      while IFS= read -r t; do tests+=("$t"); done < <(find "./games/$sel" -name '*.test.js' | sort)
    elif [ -f "../games/$sel/index.html" ]; then
      echo "no engine tests for $sel — running site tests only"
    else
      echo "unknown selector '$sel' — no game or test directory by that name." >&2
      echo "use 'site', or one of these slugs:" >&2
      (cd ../games && for g in */; do [ -f "$g/index.html" ] && echo "  ${g%/}"; done) >&2
      exit 2
    fi ;;
esac

if [ ! -d node_modules ]; then
  echo "installing test dependencies (jsdom)…"
  npm install --silent --no-audit --no-fund || exit 1
fi

# Suites are independent processes that only READ the repo, so they parallelise cleanly. The
# wall time of a full run is then the slowest single suite rather than the sum of all of them.
# Half the cores by default: the machine stays usable and each suite keeps a core's worth of
# speed, which matters because the owl searches are CPU-bound.
cores=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 2)
jobs_n="${JOBS:-$(( cores / 2 ))}"
case "$jobs_n" in ""|*[!0-9]*) echo "JOBS must be a whole number (got '${JOBS:-}')" >&2; exit 2 ;; esac
[ "$jobs_n" -lt 1 ] && jobs_n=1
[ "${#tests[@]}" -lt "$jobs_n" ] && jobs_n=${#tests[@]}
# Suites share the cores when run in parallel, so the harness's stall watchdog gets more room —
# a contended suite is slow, not stalled. It still fails by name rather than hanging the run.
[ "$jobs_n" -gt 1 ] && export WATCHDOG_MIN=15

par=""; [ "$jobs_n" -gt 1 ] && par=", $jobs_n at a time"
printf '\033[1mrunning tests: %s (%s%s)\033[0m\n' "$sel" "$mode" "$par"

work=$(mktemp -d "${TMPDIR:-/tmp}/piklu-tests.XXXXXX")
# Clean up the scratch dir however we leave; on Ctrl-C also stop the suites still running,
# by PID rather than process group, so only this run's children are signalled.
trap 'rm -rf "$work"' EXIT
trap 'kill $(jobs -p) 2>/dev/null; rm -rf "$work"; exit 130' INT TERM

n=${#tests[@]}
pass=0; fail=0; failed=()

# Print a finished suite's captured output as one block, so parallel suites never interleave.
flush() {
  local k
  for (( k = 0; k < n; k++ )); do
    [ -f "$work/$k.done" ] || continue
    [ -f "$work/$k.shown" ] && continue
    : > "$work/$k.shown"
    printf '\n\033[1m── %s\033[0m\n' "${tests[$k]#./}"
    cat "$work/$k.out"
    if [ "$(cat "$work/$k.done")" = "0" ]; then pass=$((pass+1)); else fail=$((fail+1)); failed+=("${tests[$k]#./}"); fi
  done
}

for (( i = 0; i < n; i++ )); do
  # bash 3.2 (what macOS ships) has no `wait -n`, so hold the pool by counting live jobs
  while [ "$(jobs -rp | wc -l)" -ge "$jobs_n" ]; do sleep 0.2; flush; done
  ( node "${tests[$i]}" > "$work/$i.out" 2>&1; echo $? > "$work/$i.done" ) &
done
wait
flush

printf '\n═══════════════════════════════════════\n'
if [ "$fail" -eq 0 ]; then
  printf '\033[32m✅ all %d suites passed\033[0m (%s)\n' "$pass" "$mode"; exit 0
else
  printf '\033[31m❌ %d of %d suites failed:\033[0m\n' "$fail" "$((pass+fail))"
  printf '   %s\n' "${failed[@]}"; exit 1
fi
