#!/bin/sh
# Draws a set of varied pages with florilegium-svg.lua under each Lua given (default: lua5.3 and lua5.4)
# and checks that every interpreter draws the same page byte for byte, as texlua and the
# browser's wasmoon do. CI runs it on every pull request; locally:
#   tools/svgcheck.sh                     # lua5.3 and lua5.4
#   tools/svgcheck.sh texlua lua5.4       # any interpreters
# Copyright (c) 2026 Kevin Raymond. MIT License: see LICENSE or florilegium.sty.
set -eu
[ $# -gt 0 ] || set -- lua5.3 lua5.4
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

# one line per page: the options florilegium-svg.lua gets
pages='--seed 7
--seed 3 --theme geometric --season autumn --textend 120mm
--page 2 --twoside --left 25mm --right 65mm --density 0.3
--seed 11 --paper letter --season spring --ink 1D6E7A --accent C9A227 --novisitors
--seed 5 --density 0.05 --intensity 0.5 --nohead
--seed 9 --theme math --textend 90mm
--authored'

status=0
for lua in "$@"; do
  n=0
  while read -r opts; do
    n=$((n + 1))
    # shellcheck disable=SC2086 # the options are meant to split
    "$lua" florilegium-svg.lua $opts -o "$out/$lua-$n.svg" 2>"$out/err" </dev/null || { cat "$out/err"; echo "FAIL  $lua florilegium-svg.lua $opts"; exit 1; }
    if [ "$lua" != "$1" ] && ! cmp -s "$out/$1-$n.svg" "$out/$lua-$n.svg"; then
      echo "FAIL  $lua and $1 draw different pages for: $opts"; status=1
    fi
  done <<EOF
$pages
EOF
done
for f in "$out/$1"-*.svg; do
  [ "$(wc -c < "$f")" -gt 100000 ] || { echo "FAIL  $(basename "$f") is suspiciously small"; status=1; }
done
[ $status -eq 0 ] && echo "ok    $(echo "$pages" | wc -l) pages, the same under $*"
exit $status
