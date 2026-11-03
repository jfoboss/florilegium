#!/bin/sh
# The playground loads wasmoon and MathJax from jsDelivr, and the browser runs them only if
# they hash to the SHA-384 written beside each URL in web/*.js (Subresource Integrity).
# This fetches every pinned file and checks it still does. The pages workflow runs it before
# each deploy. To move to a new version, change the URL, run this, and paste the hash it
# serves in place of the old one.
# Copyright (c) 2026 Kevin Raymond. MIT License: see LICENSE or florilegium.sty.
set -eu
cd "$(dirname "$0")/.."
status=0
for pin in $(grep -ohE "\['https://[^']+', 'sha384-[^']+'\]" web/*.js | tr -d "[]' "); do
  url=${pin%,*} want=${pin#*,}
  got=sha384-$(curl -sSfL "$url" | openssl dgst -sha384 -binary | openssl base64 -A) || got=unreachable
  if [ "$got" = "$want" ]; then
    echo "ok    $url"
  else
    printf 'FAIL  %s\n      pinned  %s\n      served  %s\n' "$url" "$want" "$got"; status=1
  fi
done
exit $status
