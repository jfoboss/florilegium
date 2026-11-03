#!/bin/sh
# Checks florilegium.ps with Ghostscript: the pages it draws for a set of options against
# expected.txt, that every spelling of an option draws the page it should, the clock seed
# and its fallbacks, the 32-bit limit on seeds, and the PDF and raster devices. About 10 s
# on 32 cores (some 40 runs of ~2.5 s at once). See README.md here for what each check means.
#   postscript/check.sh                       # the gs on the PATH
#   GS=/opt/gs-10.02/bin/gs postscript/check.sh
#   postscript/check.sh --record              # rewrite expected.txt after an intended change
# Copyright (c) 2026 Kevin Raymond. MIT License: see LICENSE or florilegium.ps.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
ps=$here/florilegium.ps
expected=$here/expected.txt
GS=${GS:-gs}
record=false
[ "${1:-}" = --record ] && record=true
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
version=$("$GS" --version)
# Ghostscript's %Calendar% reads local time; in UTC it agrees with date -u
TZ=UTC
export TZ

# run NAME FILE [options...]: a run on the null device at 72 dpi with the drawing checksum;
# its stderr goes to NAME.log and its exit status to NAME.status
run() {
  name=$1 file=$2
  shift 2
  { "$GS" -q -dSAFER -dBATCH -dNOPAUSE -sDEVICE=nullpage -r72 -dFloCheck "$@" -f "$file" \
      >"$out/$name.log" 2>&1; echo $? >"$out/$name.status"; } &
}
# lines NAME: what a run told stderr, one line, pages and checksums joined by " | "
lines() { sed -n 's/^florilegium: //p' "$out/$1.log" | awk 'BEGIN { ORS = "" } { print (NR > 1 ? " | " : "") $0 } END { print "\n" }'; }
# seeds NAME...: the seed of each page of each run
seeds() { for name; do sed -n 's/^florilegium: page seed \([0-9]*\),.*/\1/p' "$out/$name.log"; done; }
# clockseeds T0 T1: the seeds florilegium.ps's clockseed gives in each second from T0 to T1
clockseeds() {
  t=$1 end=$2
  while [ "$t" -le "$end" ]; do
    fields=$(date -u -d "@$t" '+%Y %m %d %H %M %S' 2>/dev/null || date -u -r "$t" '+%Y %m %d %H %M %S')
    h=0
    for v in $fields; do h=$(((h * 61 + ${v#0}) % 99991)); done
    echo $((h + 1))
    t=$((t + 1))
  done
}

status=0
ok() { echo "ok    $*"; }
fail() { echo "FAIL  $*"; status=1; }
warn() { echo "warn  $*"; }

# the pages expected.txt records: seeds, seasons, no visitors, with and without transparency
golden='-dALLOWPSTRANSPARENCY -dSeed=1
-dALLOWPSTRANSPARENCY -dSeed=7
-dALLOWPSTRANSPARENCY -dSeed=12
-dALLOWPSTRANSPARENCY -dSeed=250000
-dALLOWPSTRANSPARENCY -dSeed=7 -dAge=0
-dALLOWPSTRANSPARENCY -dSeed=7 -dAge=1
-dALLOWPSTRANSPARENCY -dSeed=7 -dNoVisitors
-dALLOWPSTRANSPARENCY -dSeed=99991 -dAge=0.8 -dNoVisitors
-dSeed=7
-dSeed=3 -dAge=0.2'

# groups of options that must draw the same pages as the first of their group
same='-dSeed=7;-dSeed=-7;-sSeed=7;-dSeed=7.9;-dSeed=250007;-dSeed=7 -dAge;-dSeed=7 -dAge=-3;-dSeed=7 -dAge=0.5;-dSeed=7 -dNoVisitors=false;-dSeed=7 -dNoVisitors=0
-dSeed=7 -dAge=1;-dSeed=7 -dAge=5;-dSeed=7 -sAge=1
-dSeed=7 -dNoVisitors;-dSeed=7 -dNoVisitors=1;-dSeed=7 -dNoVisitors=true'

# start every run at once, the clock's first; its second starts when all the others are done
t0=$(date +%s)
run clock1 "$ps"
n=0
while read -r opts; do
  n=$((n + 1))
  # shellcheck disable=SC2086 # the options are meant to split
  run "g$n" "$ps" $opts
done <<EOF
$golden
EOF
g=0
while read -r group; do
  g=$((g + 1)) i=0
  IFS=';'
  for opts in $group; do
    i=$((i + 1))
    unset IFS
    # shellcheck disable=SC2086
    run "s$g-$i" "$ps" $opts
    IFS=';'
  done
  unset IFS
done <<EOF
$same
EOF
sed '1a\
/Seed 7 def' "$ps" >"$out/seeded.ps"
run infile "$out/seeded.ps"
for opts in -dSeed -dSeed=0 -sSeed=junk -dSeed=0.5; do run "clock$opts" "$ps" "$opts"; done
run nocal "$ps" -c '/currentdevparams { pop nonesuch } def'
run calstop "$ps" -c '/currentdevparams { pop << /Running false >> } def'
for s in 1e20 99999999999 1793000000; do run "huge$s" "$ps" "-dSeed=$s"; done
{ "$GS" -q -dSAFER -dBATCH -dNOPAUSE -dALLOWPSTRANSPARENCY -dSeed=7 -sDEVICE=pdfwrite \
    -o "$out/garden.pdf" "$ps" >"$out/pdf.log" 2>&1; echo $? >"$out/pdf.status"; } &
{ "$GS" -q -dSAFER -dBATCH -dNOPAUSE -dALLOWPSTRANSPARENCY -dSeed=12 -sDEVICE=png16m -r300 \
    -o "$out/r300-%d.png" "$ps" >"$out/r300.log" 2>&1; echo $? >"$out/r300.status"; } &
for k in 1 2; do
  { "$GS" -q -dSAFER -dBATCH -dNOPAUSE -dALLOWPSTRANSPARENCY -dSeed=12 -sDEVICE=png16m -r40 \
      -o "$out/r40-$k-%d.png" "$ps" >"$out/r40-$k.log" 2>&1; echo $? >"$out/r40-$k.status"; } &
done
wait
t1=$(date +%s)
run clock2 "$ps"
wait
t2=$(date +%s)

# every run finished without an error
runs=0
for f in "$out"/*.status; do
  runs=$((runs + 1)) name=$(basename "$f" .status)
  if [ "$(cat "$f")" != 0 ] || grep -q 'Error' "$out/$name.log"; then
    fail "the run $name stopped with an error:"; sed 's/^/        /' "$out/$name.log" | head -8
  fi
done
[ $status -eq 0 ] && ok "$runs runs of Ghostscript $version, none with an error"

# 1. the recorded pages
if $record; then
  { echo "# florilegium.ps as Ghostscript $version draws it (nullpage, 72 dpi): the options, then"
    echo "# for each page its stats line and the checksum of all it paints. Written by check.sh --record."
    i=0
    while read -r opts; do i=$((i + 1)); echo "$opts | $(lines "g$i")"; done <<EOF
$golden
EOF
  } >"$expected"
  ok "recorded $n cases in $(basename "$expected")"
else
  recorded=$(sed -n 's/^# florilegium.ps as Ghostscript \([^ ]*\) draws it.*/\1/p' "$expected")
  i=0 bad=0 drawn=0
  while read -r opts; do
    i=$((i + 1))
    want=$(grep -F -x -e "$opts | $(lines "g$i")" "$expected" || true)
    [ -n "$want" ] && continue
    stats_only='s/ | page [0-9]* drawing [0-9]*//g'
    if grep -F -x -q -e "$opts | $(lines "g$i" | sed "$stats_only")" <<EOF
$(sed "$stats_only" "$expected")
EOF
    then drawn=$((drawn + 1)); [ "$recorded" = "$version" ] && { fail "$opts: same growth, different drawing"; bad=1; }
    else fail "$opts grows a different garden from expected.txt:"; echo "        got  $(lines "g$i")"
      echo "        want $(awk -v p="$opts |" 'index($0, p) == 1' "$expected" | grep . || echo '(no such case)')"; bad=1
    fi
  done <<EOF
$golden
EOF
  if [ $bad -eq 0 ] && [ $drawn -gt 0 ]; then
    warn "$drawn of $n cases paint differently from expected.txt but grow the same: it was recorded with Ghostscript $recorded, this is $version"
  elif [ $bad -eq 0 ]; then ok "$n cases draw the pages expected.txt records"
  fi
fi

# 2. every spelling of an option draws the page it should
g=0
while read -r group; do
  g=$((g + 1)) i=0 first='' bad=0
  IFS=';'
  for opts in $group; do
    i=$((i + 1))
    if [ $i -eq 1 ]; then first=$opts ref=$(lines "s$g-1")
    elif [ "$(lines "s$g-$i")" != "$ref" ]; then fail "$opts draws a different page from $first"; bad=1
    fi
  done
  unset IFS
  [ $bad -eq 0 ] && ok "$(echo "$group" | sed 's/;/, /g') draw the same pages"
done <<EOF
$same
EOF
if [ "$(lines infile)" = "$(lines s1-1)" ]; then ok "/Seed 7 def after the first line draws the page -dSeed=7 does"
else fail "/Seed 7 def after the first line draws a different page from -dSeed=7"
fi

# 3. the clock: the seed is the date and time (to the second) the run started at, so two
# runs seconds apart differ; without a calendar, or with a stopped one, realtime picks
c1=$(seeds clock1 | head -1) c2=$(seeds clock2 | head -1)
if clockseeds "$t0" "$t1" | grep -q -x "$c1" && clockseeds "$t1" "$t2" | grep -q -x "$c2" && [ "$c1" != "$c2" ]; then
  ok "the clock: seeds $c1 and $c2, the times two runs started at"
else fail "the clock: seeds '$c1' and '$c2', not from the times the runs started at ($(clockseeds "$t0" "$t1" | tr '\n' ' ')and $(clockseeds "$t1" "$t2" | tr '\n' ' '| sed 's/ $//'))"
fi
bad=0
for name in clock1 clock2 clock-dSeed clock-dSeed=0 clock-sSeed=junk clock-dSeed=0.5 nocal calstop; do
  s=$(seeds "$name" | head -1)
  if [ -z "$s" ] || [ "$s" -lt 1 ] || [ "$s" -gt 99991 ]; then fail "$name: the clock's seed '$s' is outside 1..99991"; bad=1; fi
done
[ $bad -eq 0 ] && ok "no seed, -dSeed, -dSeed=0, -sSeed=junk, -dSeed=0.5: the clock picks; with no calendar or a stopped one, realtime ($(seeds nocal | head -1), $(seeds calstop | head -1))"

# 4. seeds stay where seed * 7919 + 211 fits in 32 bits on every page
bad=0
for name in g4 huge1e20 huge99999999999 huge1793000000; do
  for s in $(seeds "$name"); do
    [ $((s * 7919 + 211)) -le 2147483647 ] || { fail "$name: page seed $s overflows 32 bits"; bad=1; }
  done
done
[ $bad -eq 0 ] && ok "-dSeed=250000, 1e20, 99999999999, 1793000000 keep every page in 32 bits (pages $(seeds g4 huge1e20 huge99999999999 huge1793000000 | tr '\n' ' '| sed 's/ $//'))"

# 5. the devices: a two-page PDF, 300 dpi pages (the banding crash), the same pixels twice
pages=$("$GS" -q -dNODISPLAY -dSAFER --permit-file-read="$out/" \
  -c "($out/garden.pdf) (r) file runpdfbegin pdfpagecount = quit" 2>&1)
if [ "$pages" = 2 ]; then ok "pdfwrite: $pages pages, $(($(wc -c <"$out/garden.pdf") / 1024)) KB"
else fail "pdfwrite: '$pages' pages"
fi
if [ -s "$out/r300-1.png" ] && [ -s "$out/r300-2.png" ]; then ok "png16m at 300 dpi with transparency: both pages"
else fail "png16m at 300 dpi: pages missing"
fi
cat "$out"/r40-1-*.png >"$out/a"
cat "$out"/r40-2-*.png >"$out/b"
if cmp -s "$out/a" "$out/b"; then ok "seed 12 rendered twice: the same pixels"
else fail "seed 12 rendered twice: different pixels"
fi
exit $status
