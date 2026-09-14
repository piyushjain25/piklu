#!/usr/bin/env bash
# Runs every *.test.js under _tests/. Exits non-zero if any suite fails.
set -uo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "installing test dependencies (jsdom)…"
  npm install --silent --no-audit --no-fund || exit 1
fi

pass=0; fail=0; failed=()
while IFS= read -r t; do
  printf '\n\033[1m── %s\033[0m\n' "${t#./}"
  if node "$t"; then pass=$((pass+1)); else fail=$((fail+1)); failed+=("${t#./}"); fi
done < <(find . -name '*.test.js' -not -path './node_modules/*' | sort)

printf '\n═══════════════════════════════════════\n'
if [ "$fail" -eq 0 ]; then
  printf '\033[32m✅ all %d suites passed\033[0m\n' "$pass"; exit 0
else
  printf '\033[31m❌ %d of %d suites failed:\033[0m\n' "$fail" "$((pass+fail))"
  printf '   %s\n' "${failed[@]}"; exit 1
fi
