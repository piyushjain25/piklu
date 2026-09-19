#!/usr/bin/env bash
# Runs the offline test suite. Exits non-zero if any suite fails.
#
#   ./_tests/run.sh            everything
#   ./_tests/run.sh site       only _tests/site/*.test.js (after touching games.js or assets/)
#   ./_tests/run.sh <slug>     _tests/site/* PLUS _tests/games/<slug>/* (the loop while building a game)
#
#   STRESS=quick|deep in front of any of these scales the random-sample counts of the
#   generative tests (~2% / 5x); the full counts run by default.
set -uo pipefail
self="$0"
cd "$(dirname "$0")"

usage() { sed -n '4,9p' "$(basename "$self")" | sed 's/^# \{0,1\}//'; }

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

printf '\033[1mrunning tests: %s (%s)\033[0m\n' "$sel" "$mode"

pass=0; fail=0; failed=()
for t in "${tests[@]}"; do
  printf '\n\033[1m── %s\033[0m\n' "${t#./}"
  if node "$t"; then pass=$((pass+1)); else fail=$((fail+1)); failed+=("${t#./}"); fi
done

printf '\n═══════════════════════════════════════\n'
if [ "$fail" -eq 0 ]; then
  printf '\033[32m✅ all %d suites passed\033[0m (%s)\n' "$pass" "$mode"; exit 0
else
  printf '\033[31m❌ %d of %d suites failed:\033[0m\n' "$fail" "$((pass+fail))"
  printf '   %s\n' "${failed[@]}"; exit 1
fi
