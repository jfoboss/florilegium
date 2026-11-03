#!/bin/sh
# Checks that florilegium.sty (the v-number in \ProvidesPackage) and every florilegium*.lua
# (M.version) name the same release, and, given a tag such as v1.3, that it is the tag's.
# CI runs it on every pull request and push, and with the tag when a v* tag is pushed, so a
# release can't be drafted from files that say another version. Locally:
#   tools/versioncheck.sh             # the files agree
#   tools/versioncheck.sh v1.3        # ... and say 1.3 (after the bump, before the tag)
# Copyright (c) 2026 Kevin Raymond. MIT License: see LICENSE or florilegium.sty.
set -eu
sty=$(sed -n 's/^\\ProvidesPackage{florilegium}\[[0-9/]* v\([0-9][0-9.]*\) .*/\1/p' florilegium.sty)
[ -n "$sty" ] || { echo "FAIL  florilegium.sty has no v-number in its \\ProvidesPackage line"; exit 1; }

status=0
n=0
for f in florilegium*.lua; do
  n=$((n + 1))
  v=$(sed -n 's/^M\.version = "\([^"]*\)".*/\1/p' "$f")
  [ "$v" = "$sty" ] || { echo "FAIL  $f says ${v:-no version}, florilegium.sty says $sty"; status=1; }
done
if [ $# -gt 0 ] && [ "${1#v}" != "$sty" ]; then
  echo "FAIL  the tag is $1, florilegium.sty says v$sty"; status=1
fi
[ $status -eq 0 ] && echo "ok    florilegium.sty and $n Lua files say $sty${1:+, as the tag $1 does}"
exit $status
