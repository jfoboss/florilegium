// ornaments.js — chapter ornaments on the florilegium engine.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
//
// The headpiece (a garden band above the title), the tailpiece vignette, the initial
// tile (no letter: the letter is live text).
// The headpiece is the same grown garden (grow.lua through page.js) on a low, wide sheet;
// the vignette and the tile are compositions of their own from the flora primitives.
"use strict";
const ink = require("./ink.js");
const F = require("./flora.js");
const page = require("./page.js");
const D = require("./detmath.js");
const { fixed } = require("./fmt.js");

const { sin, cos, pow } = D;
const pi = Math.PI, rad = pi / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const tone = ink.tone;
const PT_MM = 25.4 / 72;

// ---------------------------------------------------------------- drawing to SVG
// fn draws in centimeters on a w×h sheet (origin at the lower left corner, y up)
function sheet(w, h, id, fn, o) {
  o = o || {};
  const streams = [];
  ink.set_sink((s) => streams.push(s));
  const [ir, ig, ib] = page.html(o.ink || "2456C4");
  const [ar, ag, ab] = page.html(o.accent || "B4662F");
  ink.set_ink(ir, ig, ib); ink.set_accent(ar, ag, ab);
  // paleness, like florilegium's intensity: 1 is full color, less is closer to the paper
  const intensity = o.intensity === undefined ? 1 : o.intensity;
  const old = ink.set_pale(0.85 * (1 - Math.max(0, Math.min(1, intensity))));
  try {
    ink.set_transform(ink.page_transform());
    fn();
    ink.flush();
  } finally { ink.set_sink(null); ink.set_pale(old); }
  const CM = 72 / 2.54, W = w * CM, H = h * CM;
  const out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + fixed(w * 10, 2) + 'mm" height="' + fixed(h * 10, 2) +
    'mm" viewBox="0 0 ' + fixed(W, 2) + " " + fixed(H, 2) + '">',
    '<g transform="matrix(1 0 0 -1 0 ' + fixed(H, 2) + ')" stroke-linecap="round" stroke-linejoin="round">'];
  streams.forEach((s, i) => page.translate(s, out, id + (i + 1)));
  out.push("</g></svg>\n");
  return out.join("\n");
}

// ---------------------------------------------------------------- headpiece
// A W×H mm band: a narrow column on the left (roots and main stems), the rest a "last
// page" with no text: the garden's branches run right across the whole band. The mask is
// lifted on all sides but the bottom, so the band's edges don't cut leaves in a straight line.
function band(o) {
  const W = o.width, H = o.height || 80;
  const left = Math.max(22, Math.round(W * 0.2)), right = 4, top = 4, bottom = 6;
  const r = page.page({ seed: o.seed, paper: W + "x" + H, left: left + "mm", right: right + "mm", top: top + "mm",
    bottom: bottom + "mm", headsep: "0mm", headheight: "0pt", footskip: "0pt", textend: "0mm",
    ink: o.ink, accent: o.accent, season: o.season, visitors: o.visitors, id: o.id || ("flo" + o.seed + "b" + W + "-") });
  return unclip(r.svg, W, H, 60);
}
function unclip(svg, Wmm, Hmm, far) {
  const re = /(<clipPath id="[^"]+"><path d=")([^"]+)("\/><\/clipPath>)/;
  const m = re.exec(svg);
  if (!m) return svg;
  const Wpt = Wmm / PT_MM, Hpt = Hmm / PT_MM;
  const rr = /M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)Z/g;
  const rects = [];
  let r;
  while ((r = rr.exec(m[2]))) {
    let x1 = Math.min(+r[1], +r[3]), x2 = Math.max(+r[1], +r[3]);
    let y1 = Math.min(+r[2], +r[6]), y2 = Math.max(+r[2], +r[6]);
    if (x1 < 8) x1 -= far;
    if (y1 < 8) y1 -= far;
    if (y2 > Hpt - 30) y2 += far;
    if (x2 > Wpt - 30) x2 += far;
    rects.push("M" + x1 + " " + y1 + "L" + x2 + " " + y1 + "L" + x2 + " " + y2 + "L" + x1 + " " + y2 + "Z");
  }
  return svg.replace(m[0], m[1] + rects.join("") + m[3]);
}

// ---------------------------------------------------------------- chapter-end garden
// A W×H mm band under the last paragraph: the same garden, but with the column on the
// right (mirroring the headpiece), branches running left.
// By default a quiet band (the author's choice, option D): sparser and paler than the
// headpiece, in the same blue range. density and intensity as in florilegium.
function tailgarden(o) {
  const W = o.width, H = o.height;
  const density = o.density === undefined ? 0.6 : o.density;
  const intensity = o.intensity === undefined ? 0.35 : o.intensity;
  const right = Math.max(22, Math.round(W * 0.2)), left = 4, top = 4, bottom = 6;
  const r = page.page({ seed: o.seed, paper: W + "x" + H, left: left + "mm", right: right + "mm", top: top + "mm",
    bottom: bottom + "mm", headsep: "0mm", headheight: "0pt", footskip: "0pt", textend: "0mm",
    ink: o.ink, accent: o.accent, season: o.season, visitors: o.visitors, density, intensity,
    id: o.id || ("flo" + o.seed + "t" + W + "x" + H + "-") });
  return unclip(r.svg, W, H, 60);
}

// ---------------------------------------------------------------- vignette
// A flower in the center, curved stems with leaflets running from it both ways,
// a bud or floret at the ends, a copper sparkle above the flower.
// Pale, like the chapter-end band (the author's choice): intensity 0.35 by default.
function vignette(o) {
  o = Object.assign({ intensity: 0.35 }, o);
  const W = 7, H = 2.6, cx = W / 2, cy = 1.15;
  return sheet(W, H, o.id || ("flo" + o.seed + "v-"), () => {
    const rng = ink.rng(o.seed * 7919 + 307);
    const lift = rng.range(8, 16), droop = rng.range(26, 40), L0 = rng.range(2.3, 2.7);
    for (const side of [-1, 1]) {
      const r = rng.fork();
      const L = L0 * r.range(0.95, 1.05);
      const base = side > 0 ? 0 : 180;
      const h = (s) => base + side * (lift - (lift + droop) * pow(s / L, 1.6) + 70 * pow(Math.max(0, s / L - 0.8) / 0.2, 2));
      const pts = F.walk(cx + side * 0.25, cy - 0.05, h, L, 40);
      ink.layer(2);
      F.stem(pts, 0.045, 0.01, null, null, 0.3);
      // leaflets along the stem, alternating above and below
      ink.layer(3);
      const nl = r.int(3, 4);
      for (let k = 1; k <= nl; k++) {
        const f = 0.18 + 0.62 * (k - 1) / Math.max(1, nl - 1);
        const i = Math.floor(f * 40);
        const p = pts[i], q = pts[i + 1];
        const up = (k % 2 === 1) ? 1 : -1;
        const a = D.atan2(q[1] - p[1], q[0] - p[0]) / rad + side * up * r.range(35, 55);
        const ls = lerp(0.55, 0.32, f) * r.range(0.9, 1.1);
        ink.push(); ink.translate(p[0], p[1]); ink.rotate(a - 90); ink.scale(ls);
        F.leaflet(r.fork(), { bend: -side * up * 0.2 });
        ink.pop();
      }
      // florets on hairlines near the middle
      ink.layer(5);
      const mid = pts[Math.floor(40 * r.range(0.45, 0.6))];
      for (let k = 1; k <= 2; k++) {
        const qx = mid[0] + side * r.range(0.05, 0.3), qy = mid[1] + r.range(0.25, 0.45) * (k === 1 ? 1 : -0.8);
        ink.layer(2);
        ink.moveto(mid[0], mid[1]); ink.curveto(mid[0], (mid[1] + qy) / 2, (mid[0] + qx) / 2, qy, qx, qy);
        ink.stroke(tone(0.12), 0.25, 0.9);
        ink.layer(5);
        ink.push(); ink.translate(qx, qy); F.floret(r.fork(), 0.07 * r.range(0.85, 1.15)); ink.pop();
      }
      // a bud at the end
      const e = pts[pts.length - 1], d = pts[pts.length - 3];
      const ae = D.atan2(e[1] - d[1], e[0] - d[0]) / rad;
      ink.push(); ink.translate(e[0], e[1]); ink.rotate(ae - 90); F.bud(r.fork(), 0.42); ink.pop();
    }
    ink.layer(5);
    ink.push(); ink.translate(cx, cy); F.flower(rng.fork(), 0.62); ink.pop();
    ink.layer(6);
    ink.push(); ink.translate(cx, cy + 0.95); F.sparkle(rng.fork(), 0.09); ink.pop();
  }, o);
}

// ---------------------------------------------------------------- initial tile
// An S cm square: a double frame, a pale mottled wash, a vine from the lower left corner
// up the left edge and along the top to the upper right, leaflets, flowers in the corners,
// a copper sparkle at the lower right. The middle is left free for the letter.
function tile(o) {
  const S = 2;
  return sheet(S, S, o.id || ("flo" + o.seed + "i-"), () => {
    const rng = ink.rng(o.seed * 7919 + 409);
    const m = 0.05 * S;
    // wash
    ink.layer(1);
    ink.poly([[m, m], [S - m, m], [S - m, S - m], [m, S - m]], true);
    ink.fill(tone(0.9), o.wash === undefined ? 0.3 : o.wash);
    ink.poly([[m, m], [S - m, m], [S - m, S - m], [m, S - m]], true);
    ink.clip();
    F.mottle(rng.fork(), m, m, S - m, S - m, 6, S * 0.12, 0.85, 0.95, 0);
    ink.unclip();
    // frame
    ink.layer(7);
    ink.poly([[m, m], [S - m, m], [S - m, S - m], [m, S - m]], true);
    ink.stroke(tone(0.05), 1.1);
    const n = m + 0.03 * S;
    ink.poly([[n, n], [S - n, n], [S - n, S - n], [n, S - n]], true);
    ink.stroke(tone(0.05), 0.35, 0.8);
    // vine
    const j = () => rng.sym(0.025 * S);
    const ctrl = [[0.14 * S + j(), 0.1 * S], [0.13 * S + j(), 0.36 * S + j()], [0.15 * S + j(), 0.64 * S + j()],
      [0.3 * S + j(), 0.84 * S + j()], [0.62 * S + j(), 0.85 * S + j()], [0.8 * S, 0.86 * S]];
    const pts = ink.catmull(ctrl, 8);
    ink.layer(2);
    F.stem(pts, 0.022 * S, 0.006 * S, tone(0.08));
    // leaflets along the vine, inward only (to the right of its course), so they stay inside the frame
    ink.layer(3);
    const nl = rng.int(4, 5);
    for (let k = 1; k <= nl; k++) {
      const f = 0.1 + 0.72 * (k - 1) / (nl - 1) + rng.sym(0.03);
      const i = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
      const p = pts[i], q = pts[i + 1];
      const side = -1;
      const a = D.atan2(q[1] - p[1], q[0] - p[0]) / rad + side * rng.range(35, 55);
      const L = S * rng.range(0.1, 0.13) * (k % 2 === 0 ? 0.8 : 1);
      ink.push(); ink.translate(p[0], p[1]); ink.rotate(a - 90); ink.scale(L); F.leaflet(rng.fork(), { bend: -side * 0.2 }); ink.pop();
    }
    // a leaf at the vine's end, in the upper right corner
    const e = pts[pts.length - 1], d = pts[pts.length - 3];
    ink.push(); ink.translate(e[0], e[1]); ink.rotate(D.atan2(e[1] - d[1], e[0] - d[0]) / rad - 90 + 25);
    ink.scale(0.15 * S); F.leaf(rng.fork(), { w: 0.28, depth: 0 }); ink.pop();
    // flowers: in the upper left corner and at the lower left; florets on hairlines
    ink.layer(5);
    ink.push(); ink.translate(0.2 * S, 0.8 * S); F.blossom(rng.fork(), 0.085 * S); ink.pop();
    ink.push(); ink.translate(0.24 * S, 0.17 * S); F.floret(rng.fork(), 0.05 * S, { star: rng.chance(0.5) }); ink.pop();
    ink.push(); ink.translate(0.5 * S, 0.9 * S); F.floret(rng.fork(), 0.04 * S); ink.pop();
    // copper sparkle
    ink.layer(6);
    ink.push(); ink.translate(S - 0.15 * S, 0.17 * S); F.sparkle(rng.fork(), 0.045 * S); ink.pop();
  }, o);
}

module.exports = { band, tailgarden, vignette, tile, sheet, unclip };
