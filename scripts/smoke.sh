#!/usr/bin/env bash
# Quick health check against the deployed site. Usage: scripts/smoke.sh https://xxxx.cloudfront.net
set -euo pipefail
URL="${1:?usage: smoke.sh <site-url>}"
BODY=$(mktemp)

check() {
  local path="$1" expected="$2" code
  code=$(curl -s -o "$BODY" -w '%{http_code}' "$URL$path")
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL $path -> $code (expected $expected)"
    cat "$BODY"
    exit 1
  fi
  echo "ok   $path -> $code"
}

check / 200
check /api/products 200
grep -q '"headphones"' "$BODY" || { echo "FAIL /api/products has no products"; exit 1; }
# Deep links must load the app (SPA rewrite)...
check /orders/some-deep-link 200
grep -q '<div id="root">' "$BODY" || { echo "FAIL deep link did not return index.html"; exit 1; }
# ...but real API 404s must stay JSON 404s
check /api/orders/does-not-exist 404
grep -q '"NOT_FOUND"' "$BODY" || { echo "FAIL API 404 is not JSON"; exit 1; }

echo "Smoke test passed for $URL"
