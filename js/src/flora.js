// flora.js — a port of florilegium-flora.lua (florilegium, Kevin Raymond, MIT): the garden primitives.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
// Each primitive draws in its own local frame (cm) under the current ink
// transform and takes an rng. Translated line by line: the same order of
// generator calls, the same expressions in the same order (or the bits diverge).
"use strict";
const ink = require("./ink.js");
const D = require("./detmath.js");

const { sin, cos, pow } = D;
const sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor, max = Math.max, min = Math.min;
const pi = Math.PI;
const tone = ink.tone, white = ink.white;
const rad = pi / 180;
const M = {};

const lerp = (a, b, t) => a + (b - a) * t;
const lod = () => ink.unit();
const ghost = () => ink.get_lift() > 0.3;
// modulo as in Lua 5.3 (luai_nummod): fmod, then shift toward the divisor's sign
function lmod(a, b) {
  let m = a % b;
  if (m > 0 ? b < 0 : (m < 0 && b !== m)) m += b;
  return m;
}
M.lmod = lmod;
const nz = (v) => v !== undefined && v !== null;   // Lua: v ~= nil
const or = (v, d) => (v === undefined || v === null || v === false) ? d() : v;   // Lua: v or d

// ---------------------------------------------------------------- washes
function speck(x, y, r, a) {
  const c = cos(a), s = sin(a);
  ink.poly([[x + r * c, y + r * s], [x - 0.6 * r * s, y + 0.6 * r * c], [x - r * c, y - r * s], [x + 0.6 * r * s, y - 0.6 * r * c]], true);
}
function mottle(rng, x0, y0, x1, y1, n, size, dark, light, specks) {
  for (let i = 1; i <= n; i++) {
    const x = rng.range(x0, x1), y = rng.range(y0, y1);
    const r = size * rng.range(0.5, 1.4);
    ink.smooth(ink.blob(rng, x, y, r, r * rng.range(0.5, 1), 0.35, 7), true);
    if (rng.chance(0.6)) ink.fill(tone(dark + rng.sym(0.06)), rng.range(0.10, 0.22), true);
    else ink.fill(tone(light + rng.sym(0.06)), rng.range(0.12, 0.26));
  }
  if (specks && specks > 0 && !ghost()) {
    for (let i = 1; i <= specks; i++) speck(rng.range(x0, x1), rng.range(y0, y1), size * rng.range(0.03, 0.08), rng.range(0, pi));
    ink.fill(tone(dark - 0.08), rng.range(0.3, 0.5), true);
  }
}
M.mottle = mottle;

function streak(f, n, w0, w1, c, op, mult) {
  const pts = ink.sample(f, n);
  ink.smooth(ink.ribbon(pts, (u) => lerp(w0, w1, u) * (u < 0.12 ? (0.4 + 5 * u) : 1)), true);
  ink.fill(c, op, mult);
}
M.streak = streak;

function streak3(x0, y0, x1, y1, x2, y2, x3, y3, w0, w1, c, op, mult) {
  ink.taper(x0, y0, x1, y1, x2, y2, x3, y3, w0, w1);
  ink.fill(c, op, mult);
}
M.streak3 = streak3;

// ---------------------------------------------------------------- petal
function round_half(W) {
  return function (v) {
    const m = 0.62;
    if (v < m) return W * (0.16 + 0.84 * pow(sin(pi / 2 * v / m), 1.3));
    const q = (v - m) / (1 - m);
    return W * sqrt(max(0, 1 - q * q));
  };
}

M.petal = function (rng, o) {
  o = o || {};
  const pointed = o.shape === "pointed";
  const W = or(o.w, () => pointed ? rng.range(0.15, 0.2) : rng.range(0.40, 0.48));
  const bend = or(o.bend, () => rng.sym(0.08));
  const t0 = or(o.tone, () => rng.range(0.34, 0.42));
  const u = lod();
  const fine = u > 0.45 && !ghost();
  const wave = ink.fbm1(rng, 3);
  const notch = (!pointed && rng.chance(0.4)) ? rng.range(0.03, 0.06) : 0;
  const spine = (v) => [bend * v * v, v];
  let half;
  if (pointed) half = (v) => W * 2 * pow(sin(pi * pow(v, 0.8)), 0.85) * (1 - 0.3 * v);
  else half = round_half(W);
  const edge = function (v, side) {
    let e = (pointed ? 0.012 : 0.03) * wave(v * 6 + (side > 0 ? 0 : 40)) * v;
    if (notch > 0 && v > 0.9) e = e - notch * (v - 0.9) * 10 * (1 - (v - 0.9) * 10);
    return e;
  };
  const outline = ink.blade(spine, u > 0.5 ? 28 : 18, half, half, edge);
  ink.smooth(outline, true);
  ink.clip();
  ink.flood(tone(t0), -1, -0.1, 1, 1.2);
  if (o.heart !== false) {
    for (let k = 1; k <= 8; k++) {
      ink.smooth(ink.blob(rng, 0, 0, W * (0.25 + 0.1 * k), 0.06 + 0.065 * k, 0.28, 9), true);
      ink.fill(white, 0.1);
    }
  }
  mottle(rng, -W * 1.2, 0.12, W * 1.2, 1.05, fine ? 15 : 6, pointed ? 0.06 : 0.12, t0 - 0.2, t0 + 0.2, fine ? 12 : 0);
  if (fine) {
    const n = rng.int(5, 8);
    for (let i = 1; i <= n; i++) {
      const f = rng.sym(0.95);
      const v0 = rng.range(0.15, 0.4), v1 = rng.range(0.7, 1.0);
      const x0 = f * half(v0) * 0.8 + bend * v0 * v0, x1 = f * half(v1) * 0.9 + bend * v1 * v1;
      streak3(x0, v0, x0 + (x1 - x0) * 0.3, lerp(v0, v1, 0.35), x1 * 0.95, lerp(v0, v1, 0.7), x1, v1,
        rng.range(0.03, 0.07), 0.005, tone(t0 - 0.25), rng.range(0.12, 0.25), true);
    }
  }
  ink.smooth(outline, true);
  ink.stroke(tone(0.08), 1.6 * u, ghost() ? 0.15 : 0.3, true);
  const ns = or(o.streaks, () => pointed ? rng.int(3, 5) : rng.int(9, 13));
  for (let k = 1; k <= ns; k++) {
    let f = (k - 0.5) / ns * 2 - 1 + rng.sym(0.05);
    let len = (pointed ? rng.range(0.4, 0.85) : rng.range(0.35, 0.8)) * (1 - 0.35 * f * f);
    if (pointed && k === floor((ns + 1) / 2)) { f = 0; len = rng.range(0.8, 0.92); }
    const x1 = f * half(len) * 0.85 + bend * len * len;
    const mx = f * half(len * 0.5) * 0.6 + rng.sym(0.02) + bend * len * len * 0.3;
    streak3(f * 0.03, 0.0, mx * 0.5, len * 0.3, mx, len * 0.6, x1, len,
      (pointed ? 0.6 : 1) * rng.range(0.022, 0.045), 0.002, white, rng.range(0.55, 0.9));
  }
  if (fine) {
    const n = rng.int(4, 7);
    for (let i = 1; i <= n; i++) {
      const f = rng.sym(0.85);
      const v0 = rng.range(0.2, 0.35), v1 = rng.range(0.75, 0.95);
      const x0 = f * half(v0) * 0.7 + bend * v0 * v0, x1 = f * half(v1) * 0.9 + bend * v1 * v1;
      ink.smooth(ink.sample(ink.bezier3(x0, v0, x0 + (x1 - x0) * 0.2, lerp(v0, v1, 0.4), x1 * 0.97, lerp(v0, v1, 0.75), x1, v1), 5), false);
      ink.stroke(tone(0.1), 0.15, rng.range(0.18, 0.32), true);
    }
  }
  ink.unclip();
  return outline;
};

// ---------------------------------------------------------------- flowers
function heart(rng, np, r) {
  for (let k = 1; k <= 2 * np; k++) {
    const a = (k - 0.5) * 360 / (2 * np) + rng.sym(8);
    ink.push(); ink.rotate(a);
    streak3(0, 0, 0.01, 0.1 * r, -0.01, 0.2 * r, 0, rng.range(0.24, 0.36) * r, 0.06 * r, 0.004 * r, white, 0.85);
    ink.pop();
  }
  ink.circle(0, 0, 0.13 * r); ink.fill(white, 0.9);
  if (!ghost()) {
    for (let i = 1; i <= 14; i++) {
      const a = rng.range(0, 2 * pi), d = rng.range(0.05, 0.12) * r;
      ink.moveto(0, 0); ink.lineto(d * cos(a), d * sin(a));
      ink.stroke(tone(0.1), 0.2, 0.7);
      ink.circle(d * cos(a), d * sin(a), 0.008 * r); ink.fill(tone(0.05), 0.9);
    }
  }
  ink.circle(0, 0, 0.042 * r); ink.fill(ink.accent(-0.15));
  ink.circle(0, 0, 0.022 * r); ink.fill(ink.accent(0.3));
}

M.flower = function (rng, s, o) {
  o = o || {};
  ink.push();
  ink.scale(s);
  ink.rotate(rng.range(0, 72));
  const np = or(o.petals, () => 5);
  const t0 = or(o.tone, () => rng.chance(0.25) ? rng.range(0.2, 0.28) : rng.range(0.3, 0.46));
  for (let k = 0; k <= np - 1; k++) {
    ink.push();
    ink.rotate(k * 360 / np + rng.sym(6));
    ink.scale(rng.range(0.9, 1.06));
    ink.translate(0, 0.04);
    M.petal(rng, { tone: t0 + rng.sym(0.04) });
    ink.pop();
  }
  heart(rng, np, 1);
  ink.pop();
};

// With distinct keys Lua's table.sort gives the same order as any correct
// sort: the keys here are sines of random angles, with no ties.
M.lily = function (rng, s, o) {
  o = o || {};
  ink.push();
  ink.scale(s);
  const tilt = or(o.tilt, () => rng.range(0.45, 0.62));
  const spin = rng.range(0, 60);
  const t0 = or(o.tone, () => rng.range(0.30, 0.38));
  const order = [];
  for (let k = 0; k <= 5; k++) order.push(spin + k * 60 + rng.sym(8));
  order.sort((a, b) => { const sa = sin(a * rad), sb = sin(b * rad); return sa > sb ? -1 : (sb > sa ? 1 : 0); });
  for (const a of order) {
    const back = sin(a * rad);
    ink.push();
    ink.scale(1, tilt);
    ink.rotate(a - 90);
    ink.scale(rng.range(0.88, 1.05));
    // Lua evaluates table fields in the order written
    const w = rng.range(0.11, 0.14);
    const tn = t0 + 0.1 * back * -0.8 + rng.sym(0.03);
    const bend = (rng.chance(0.5) ? 1 : -1) * rng.range(0.04, 0.14);
    const streaks = rng.int(3, 4);
    M.petal(rng, { shape: "pointed", w, tone: tn, bend, heart: false, streaks });
    ink.pop();
  }
  for (let k = 1; k <= 4; k++) {
    ink.smooth(ink.blob(rng, 0, 0, 0.05 + 0.05 * k, (0.05 + 0.05 * k) * tilt, 0.2, 9), true);
    ink.fill(white, 0.22);
  }
  if (!ghost()) {
    for (let k = 1; k <= 6; k++) {
      const a = (k - 3.5) * 16 + rng.sym(6);
      const L = rng.range(0.3, 0.48);
      const ex = L * sin(a * rad), ey = L * cos(a * rad);
      ink.smooth(ink.sample(ink.bezier3(0, 0, ex * 0.2, ey * 0.5, ex * 0.8, ey * 0.85, ex, ey), 6), false);
      ink.stroke(tone(0.12), 0.25, 0.85);
      ink.push(); ink.translate(ex, ey); ink.rotate(-a + rng.sym(30));
      ink.smooth(ink.blob(rng, 0, 0, 0.022, 0.04, 0.1, 6), true); ink.fill(tone(0.05));
      ink.pop();
      if (rng.chance(0.5)) { ink.circle(ex + rng.sym(0.03), ey + rng.range(0.02, 0.05), 0.008); ink.fill(ink.accent(0)); }
    }
  }
  ink.circle(0, 0, 0.035); ink.fill(ink.accent(-0.2));
  ink.pop();
};

M.blossom = function (rng, r, o) {
  o = o || {};
  ink.push();
  ink.scale(r);
  ink.rotate(rng.range(0, 72));
  const t0 = or(o.tone, () => rng.range(0.30, 0.45));
  for (let k = 0; k <= 4; k++) {
    ink.push();
    ink.rotate(k * 72 + rng.sym(8));
    ink.scale(rng.range(0.9, 1.08));
    const hw = round_half(rng.range(0.36, 0.44));
    const outline = ink.blade((v) => [0, v], 18, hw, hw);
    ink.smooth(outline, true); ink.fill(tone(t0 + rng.sym(0.05)));
    ink.smooth(outline, true); ink.clip();
    ink.smooth(ink.blob(rng, rng.sym(0.2), rng.range(0.5, 0.9), 0.35, 0.3, 0.3, 8), true);
    ink.fill(tone(t0 - 0.2), 0.3, true);
    streak3(0, 0, 0.02, 0.2, -0.02, 0.4, rng.sym(0.05), 0.55, 0.12, 0.01, white, 0.7);
    ink.smooth(outline, true); ink.stroke(tone(0.08), 1.2 * lod(), 0.25, true);
    ink.unclip();
    ink.pop();
  }
  ink.circle(0, 0, 0.22); ink.fill(white, 0.85);
  ink.circle(0, 0, 0.09); ink.fill(or(o.eye, () => tone(0.08)));
  ink.pop();
};

M.floret = function (rng, r, o) {
  o = o || {};
  let star = o.star;
  if (star === undefined || star === null) star = rng.chance(0.5);
  if (r * lod() < 0.07) {
    const ph = rng.range(0, 2 * pi), pts = [];
    for (let k = 0; k <= 9; k++) {
      const a = ph + k * pi / 5;
      const d = (k % 2 === 0) ? r : r * (star ? 0.32 : 0.62);
      pts.push([d * cos(a), d * sin(a)]);
    }
    ink.poly(pts, true); ink.fill(tone(or(o.tone, () => rng.range(0.22, 0.42))));
    const e = 0.2 * r;
    ink.poly([[e, 0], [0, e], [-e, 0], [0, -e]], true); ink.fill(or(o.eye, () => tone(0.05)));
    return;
  }
  const ph = rng.range(0, 2 * pi);
  for (let k = 0; k <= 4; k++) {
    const a = ph + k * 2 * pi / 5 + rng.sym(0.15);
    const c = cos(a), s = sin(a);
    const L = r * rng.range(0.85, 1.1);
    const w = star ? 0.26 : 0.42;
    let pts;
    if (star) pts = [[0, 0], [0.45 * L, w * L * 0.6], [L, 0], [0.45 * L, -w * L * 0.6]];
    else pts = [[0, 0], [0.3 * L, w * L], [0.85 * L, w * L * 0.8], [L, 0], [0.85 * L, -w * L * 0.8], [0.3 * L, -w * L]];
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; pts[i] = [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
    ink.smooth(pts, true, star ? 0.5 : 1);
  }
  const t0 = or(o.tone, () => rng.range(0.22, 0.42));
  ink.fill(tone(t0));
  if (r > 0.05 && !ghost()) { ink.circle(0, 0, 0.35 * r); ink.fill(white, 0.75); }
  ink.circle(0, 0, 0.16 * r); ink.fill(or(o.eye, () => tone(0.05)));
};

M.bud = function (rng, s, o) {
  o = o || {};
  ink.push(); ink.scale(s);
  const bend = rng.sym(0.1);
  const outline = ink.blade((v) => [bend * v * v, v], 18,
    (v) => 0.3 * pow(sin(pi * pow(v, 0.6)), 0.8), (v) => 0.3 * pow(sin(pi * pow(v, 0.6)), 0.8));
  const t0 = or(o.tone, () => rng.range(0.3, 0.42));
  ink.smooth(outline, true); ink.fill(tone(t0));
  ink.smooth(outline, true); ink.clip();
  mottle(rng, -0.3, 0, 0.3, 1, 5, 0.1, t0 - 0.2, t0 + 0.2, 0);
  streak3(-0.08, 0.05, -0.1, 0.35, -0.05, 0.65, bend * 0.8, 0.95, 0.06, 0.005, white, 0.7);
  ink.smooth(outline, true); ink.stroke(tone(0.06), 1.4 * lod(), 0.3, true);
  ink.unclip();
  for (let k = -1; k <= 1; k++) {
    const a = k * 24 + rng.sym(6);
    ink.push(); ink.translate(k * 0.05, -0.02); ink.rotate(a); ink.scale(0.06, k === 0 ? 0.22 : 0.32);
    ink.smooth(ink.blade((v) => [-k * 0.4 * v * v, v], 8, (v) => sin(pi * pow(v, 0.6)), (v) => sin(pi * pow(v, 0.6))), true);
    ink.pop();
  }
  ink.fill(tone(0.14), 0.9);
  ink.pop();
};

M.bell = function (rng, s, o) {
  o = o || {};
  ink.push(); ink.scale(s); ink.rotate(rng.sym(8));
  const t0 = or(o.tone, () => rng.range(0.3, 0.4));
  let pts;
  const side = function (sg) {
    const out = [];
    for (let i = 0; i <= 10; i++) {
      const v = i / 10;
      out.push([sg * (0.12 + 0.22 * pow(v, 1.4) + 0.08 * pow(v, 6)), -0.02 - 0.82 * v]);
    }
    return out;
  };
  const R = side(1), Lft = side(-1);
  pts = [];
  for (const p of R) pts.push(p);
  const tips = [[0.44, -0.98], [0.12, -1.0], [-0.16, -1.0], [-0.44, -0.98]];
  const sinus = [[0.27, -0.86], [-0.02, -0.9], [-0.29, -0.86]];
  { const x = tips[0][0] + rng.sym(0.03); pts.push([x, tips[0][1] + rng.sym(0.03)]); }
  for (let i = 1; i <= 3; i++) {
    pts.push([sinus[i - 1][0], sinus[i - 1][1] + rng.sym(0.02)]);
    const x = tips[i][0] + rng.sym(0.03);
    pts.push([x, tips[i][1] + rng.sym(0.03)]);
  }
  for (let i = Lft.length - 1; i >= 0; i--) pts.push(Lft[i]);
  ink.smooth(pts, true, 0.7); ink.fill(tone(t0));
  ink.smooth(pts, true, 0.7); ink.clip();
  mottle(rng, -0.5, -1.0, 0.5, 0, 10, 0.12, t0 - 0.2, t0 + 0.2, 10);
  for (let k = -2; k <= 2; k++) {
    const x = k * 0.1;
    const even = lmod(k, 2) === 0;
    streak3(x * 0.3, -0.05, x * 0.8, -0.35, x * 1.3, -0.65, x * 1.9 + rng.sym(0.03), -0.92, 0.02, 0.012,
      even ? white : tone(0.08), even ? 0.55 : 0.3, !even);
  }
  ink.smooth(pts, true, 0.7); ink.stroke(tone(0.06), 1.5 * lod(), 0.3, true);
  ink.unclip();
  ink.smooth(pts, true, 0.7); ink.stroke(tone(0.08), 0.18, 0.35);
  for (let k = -1; k <= 1; k++) {
    ink.push(); ink.translate(0, 0.02); ink.rotate(180 + k * 40 + rng.sym(8)); ink.scale(0.08, 0.26);
    ink.smooth(ink.blade((v) => [0, v], 8, (v) => sin(pi * pow(v, 0.7)), (v) => sin(pi * pow(v, 0.7))), true);
    ink.pop();
  }
  ink.fill(tone(0.1));
  ink.circle(0, 0.02, 0.06); ink.fill(tone(0.08));
  ink.pop();
};

// ---------------------------------------------------------------- foliage
M.leaf = function (rng, o) {
  o = o || {};
  const W = or(o.w, () => rng.range(0.20, 0.27));
  const bend = or(o.bend, () => rng.sym(0.25));
  const lobes = or(o.lobes, () => rng.int(3, 5));
  const depth = or(o.depth, () => rng.range(0.3, 0.7));
  const t0 = or(o.tone, () => rng.range(0.26, 0.38));
  const u = lod();
  const fine = u > 0.6 && !ghost();
  const spine = (v) => [bend * v * v - 0.3 * bend * v, v];
  const tangent = function (v) {
    const [x0, y0] = spine(max(0, v - 0.01)); const [x1, y1] = spine(min(1, v + 0.01));
    const dx = x1 - x0, dy = y1 - y0; const L = sqrt(dx * dx + dy * dy);
    return [dx / L, dy / L];
  };
  const envelope = (v) => W * 2.3 * pow(v, 0.55) * pow(1 - v, 0.95);
  const teeth = (v) => 0.006 * (1 - abs(2 * lmod(v * 9, 1) - 1));
  const veins = [];
  const bodyw = depth > 0 ? (1 - 0.75 * depth) : 1;
  const hb = (v) => envelope(v) * bodyw;
  const outline = ink.blade(spine, u > 0.6 ? 36 : 24, hb, hb, (v) => (depth > 0 ? 0 : 1) * teeth(v * 3));
  const shapes = [outline];
  if (depth > 0) {
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 1; k <= lobes; k++) {
        const v = 0.1 + 0.72 * (k - (side > 0 ? 0.25 : 0.75)) / lobes;
        const [x0, y0] = spine(v);
        const [tx, ty] = tangent(v);
        const reach = envelope(min(0.95, v + 0.08)) * rng.range(0.95, 1.15);
        const ang = rng.range(38, 58) * rad;
        const c = cos(ang), sn = sin(ang) * side;
        const dx = tx * c - ty * sn, dy = tx * sn + ty * c;
        const L = reach / sin(ang) * 0.95;
        const lb = rng.sym(0.25) - side * 0.15;
        const ls = (t) => [x0 + dx * L * t - dy * lb * L * t * t, y0 + dy * L * t + dx * lb * L * t * t];
        const lw = (t) => L * rng.range(0.26, 0.3) * pow(sin(pi * pow(t, 0.62)), 0.75);
        const lobe = ink.blade(ls, 11, lw, lw, (t, sd) => t > 0.2 ? teeth(t * 1.4 + k) * L * 4 : 0);
        shapes.push(lobe);
        const [mx, my] = ls(0.45);
        const [ex, ey] = ls(0.92);
        veins.push([x0, y0, mx, my, ex, ey]);
      }
    }
  }
  const trace = () => { for (const sh of shapes) ink.smooth(sh, true, 0.8); };
  trace(); ink.fill(tone(t0));
  trace(); ink.clip();
  const sd = rng.chance(0.5) ? 1 : -1;
  const hp = [];
  for (let i = 0; i <= 30; i++) { const [x, y] = spine(i / 30); hp.push([x, y]); }
  hp.push([sd * 2, 1]); hp.push([sd * 2, 0]);
  ink.poly(hp, true);
  ink.fill(tone(0.12), 0.28, true);
  mottle(rng, -W * 2.5, 0, W * 2.5, 1, fine ? 13 : 6, 0.11, t0 - 0.2, t0 + 0.22, fine ? 12 : 0);
  trace();
  ink.stroke(tone(0.06), 1.3 * u, 0.22, true);
  streak(spine, 10, 0.03, 0.003, white, 0.78);
  for (const vn of veins) {
    const [x0, y0, mx, my, ex, ey] = vn;
    streak3(x0, y0, mx, my, mx + (ex - mx) * 0.5, my + (ey - my) * 0.5, ex, ey, 0.017, 0.002, white, rng.range(0.5, 0.75));
  }
  if (depth === 0 || veins.length === 0) {
    for (let k = 1; k <= 9; k++) {
      const v = (k - 0.3) / 10 * 0.9;
      const sg = (k % 2 === 0) ? 1 : -1;
      const [x0, y0] = spine(v);
      const [tx, ty] = tangent(v);
      const nx = -ty * sg, ny = tx * sg;
      const L = hb(v) * rng.range(0.75, 0.95);
      streak3(x0, y0, x0 + nx * L * 0.4, y0 + ny * L * 0.4, x0 + nx * L * 0.75 + tx * L * 0.3, y0 + ny * L * 0.75 + ty * L * 0.3,
        x0 + nx * L * 0.95 + tx * L * 0.6, y0 + ny * L * 0.95 + ty * L * 0.6, 0.014, 0.002, white, rng.range(0.45, 0.7));
    }
  }
  ink.unclip();
  if (depth === 0) {
    ink.smooth(outline, true, 0.8);
    ink.stroke(tone(0.05), 0.18, ghost() ? 0.15 : 0.4);
  }
};

M.leaflet = function (rng, o) {
  o = o || {};
  const W = or(o.w, () => rng.range(0.16, 0.24));
  const bend = or(o.bend, () => rng.sym(0.2));
  const t0 = or(o.tone, () => rng.range(0.2, 0.34));
  const spine = (v) => [bend * v * v, v];
  const half = (v) => W * 2.2 * pow(v, 0.5) * pow(1 - v, 0.9);
  const outline = ink.blade(spine, 18, half, half);
  const c = outline.c, nrm = outline.nrm;
  ink.smooth(outline, true); ink.fill(tone(t0));
  if (lod() > 0.25 && !ghost()) {
    ink.smooth(outline, true); ink.clip();
    const sd = rng.chance(0.5) ? 1 : -1;
    const hp = [];
    for (let i = 0; i < c.length; i++) hp.push(c[i]);
    for (let i = c.length - 1; i >= 0; i--) hp.push([c[i][0] + sd * nrm[i][0], c[i][1] + sd * nrm[i][1]]);
    ink.poly(hp, true); ink.fill(tone(0.08), 0.3, true);
    streak(spine, 10, 0.03, 0.003, white, 0.65);
    ink.unclip();
  }
};

// ---------------------------------------------------------------- stems and sprays
M.stem = function (pts, w0, w1, c, op, tip) {
  const wbp = (w0 + w1) / 2 * ink.unit() * ink.CM;
  if (wbp < 0.7) {
    ink.smooth(pts, false);
    ink.stroke(or(c, () => tone(0.07)), wbp, op);
    return;
  }
  let width = (t) => lerp(w0, w1, t);
  if (nz(tip) && tip !== false) {
    const L = ink.arclen(pts).total;
    const f = min(1, tip / max(L, 1e-9));
    width = (t) => lerp(w0, w1, t) * (t > 1 - f ? lerp(1, 0.15, (t - 1 + f) / f) : 1);
  }
  ink.smooth(ink.ribbon(pts, width), true);
  ink.fill(or(c, () => tone(0.07)), op);
};

M.branch_path = function (rng, sx, sy, tx, ty, bx, by, ax, ay) {
  const dx = bx - sx, dy = by - sy;
  const d = sqrt(dx * dx + dy * dy);
  if (tx * dx + ty * dy < -0.3 * d) { tx = -tx; ty = -ty; }
  const turn = (tx * dy - ty * dx > 0 ? 1 : -1) * rng.range(28, 48) * rad;
  const ox = tx * cos(turn) - ty * sin(turn), oy = tx * sin(turn) + ty * cos(turn);
  return ink.sample(ink.bezier3(sx, sy, sx + ox * d * 0.45, sy + oy * d * 0.45, bx - ax * d * 0.4, by - ay * d * 0.4, bx, by),
    max(6, floor(d / 0.15)));
};

function walk(x, y, h, L, n) {
  const pts = [[x, y]], ds = L / n;
  for (let i = 1; i <= n; i++) {
    const a = h((i - 0.5) * ds) * rad;
    x = x + ds * cos(a); y = y + ds * sin(a);
    pts.push([x, y]);
  }
  return pts;
}
M.walk = walk;

function curl(rng, x, y, h0, L, side, t0, wbase) {
  const turn = rng.range(170, 270);
  const N = 36;
  const pts = walk(x, y, (s) => h0 + side * turn * pow(s / L, 2.3), L, N);
  M.stem(pts, wbase, 0.006, tone(0.1));
  const nrm = ink.normals(pts);
  const n = rng.int(11, 17);
  for (let k = 1; k <= n; k++) {
    const f = 0.18 + 0.82 * pow(k / n, 0.75);
    const i = max(2, min(pts.length, floor(f * N + 1.5)));          // Lua index
    const sg = (k % 2 === 0) ? 1 : -1;
    const px = pts[i - 1][0], py = pts[i - 1][1];
    const stalk = lerp(0.1, 0.02, f) * rng.range(0.7, 1.2);
    const qx = px + nrm[i - 1][0] * sg * stalk, qy = py + nrm[i - 1][1] * sg * stalk;
    if (stalk > 0.03) { ink.moveto(px, py); ink.lineto(qx, qy); ink.stroke(tone(0.12), 0.25, 0.9); }
    const r = lerp(0.115, 0.03, f) * rng.range(0.85, 1.15);
    ink.push(); ink.translate(qx, qy);
    if (f > 0.8) { ink.circle(0, 0, r * 0.6); ink.fill(tone(t0 - 0.06)); }
    else M.floret(rng, r, { star: false, tone: t0 + rng.sym(0.08) });
    ink.pop();
  }
  return pts;
}

M.cyme = function (rng, L, o) {
  o = o || {};
  const side = or(o.side, () => rng.chance(0.5) ? 1 : -1);
  const t0 = rng.range(0.22, 0.36);
  const pts = curl(rng, 0, 0, 90 + rng.sym(10), L, side, t0, 0.026);
  if ((o.fork !== false) && rng.chance(o.fork ? 1 : 0.6)) {
    const i = floor(pts.length * rng.range(0.25, 0.4));            // Lua index
    const a = pts[i], b = pts[i - 1];                               // Lua: pts[i + 1], pts[i]
    const h = D.atan2(a[1] - b[1], a[0] - b[0]) / rad;
    const h2 = h - side * rng.range(30, 50);
    curl(rng, b[0], b[1], h2, L * rng.range(0.45, 0.65), -side, t0 + 0.04, 0.018);
  }
};

M.sprig = function (rng, L, o) {
  o = o || {};
  const depth = or(o.depth, () => 4);
  const t0 = rng.range(0.22, 0.4);
  const branch = function (x, y, a, len, d, w) {
    const bend = rng.sym(20);
    const pts = walk(x, y, (s) => a + bend * s / len, len, 6);
    M.stem(pts, w, w * 0.7, tone(0.1));
    const ex = pts[pts.length - 1][0], ey = pts[pts.length - 1][1];
    const ea = a + bend;
    if (d === 0) {
      ink.push(); ink.translate(ex, ey);
      if (rng.chance(0.7)) M.floret(rng, rng.range(0.045, 0.075), { tone: t0 + rng.sym(0.08) });
      else { ink.circle(0, 0, rng.range(0.018, 0.028)); ink.fill(tone(t0 - 0.05)); }
      ink.pop();
      return;
    }
    if (d >= depth - 1 && rng.chance(0.7)) {
      const sg = rng.chance(0.5) ? 1 : -1;
      ink.push(); ink.translate(ex, ey); ink.rotate(ea - 90 + sg * rng.range(40, 70)); ink.scale(len * rng.range(0.5, 0.8));
      M.leaflet(rng, { w: 0.14 });
      ink.pop();
    }
    const kids = rng.chance(0.25) ? 3 : 2;
    for (let k = 1; k <= kids; k++) {
      const da = (kids === 2) ? (k === 1 ? -1 : 1) * rng.range(16, 34) : (k - 2) * rng.range(22, 36);
      branch(ex, ey, ea + da, len * rng.range(0.58, 0.74), d - 1, w * 0.72);
    }
  };
  branch(0, 0, 90 + rng.sym(8), L * 0.36, depth, 0.024);
};

M.umbel = function (rng, R, o) {
  const nr = rng.int(9, 13);
  for (let k = 1; k <= nr; k++) {
    const a = 90 + (k - (nr + 1) / 2) * (110 / nr) + rng.sym(4);
    const L = R * rng.range(0.78, 1.0) * (1 - 0.15 * abs(a - 90) / 55);
    const ex = L * cos(a * rad), ey = L * sin(a * rad);
    ink.smooth(ink.sample(ink.bezier3(0, 0, ex * 0.15, ey * 0.5, ex * 0.6, ey * 0.95, ex, ey), 6), false);
    ink.stroke(tone(0.12), 0.25, 0.9);
    const ns = rng.int(5, 8);
    for (let j = 1; j <= ns; j++) {
      const b = a + (j - (ns + 1) / 2) * 16 + rng.sym(5);
      const l = R * rng.range(0.12, 0.2);
      const fx = ex + l * cos(b * rad), fy = ey + l * sin(b * rad);
      ink.moveto(ex, ey); ink.lineto(fx, fy); ink.stroke(tone(0.14), 0.18, 0.85);
      ink.push(); ink.translate(fx, fy);
      const fr = R * rng.range(0.035, 0.05);
      M.floret(rng, fr, { star: true, tone: rng.range(0.25, 0.42) });
      ink.pop();
    }
  }
  for (let k = -1; k <= 1; k++) {
    ink.push(); ink.rotate(k * 40 + rng.sym(10) + 180); ink.scale(R * rng.range(0.15, 0.22));
    M.leaflet(rng, { w: 0.06, bend: k * 0.2 });
    ink.pop();
  }
};

function tuft(x, y, a, l) {
  for (let j = -2; j <= 2; j++) {
    const b = a + j * 0.32;
    ink.moveto(x, y); ink.lineto(x + l * cos(b), y + l * sin(b));
  }
}
M.seedhead = function (rng, r, o) {
  o = o || {};
  const fine = lod() * r > 0.2 && !ghost();
  const n = fine ? rng.int(26, 34) : 16;
  const gone = rng.range(0, 2 * pi);
  for (let k = 1; k <= n; k++) {
    const a = 2 * pi * (k + rng.sym(0.3)) / n;
    if (!(abs(lmod(a - gone + pi, 2 * pi) - pi) < 0.5 && rng.chance(0.7))) {
      const L = r * rng.range(0.72, 0.86);
      const c = cos(a), s = sin(a);
      ink.moveto(0.1 * r * c, 0.1 * r * s); ink.lineto(L * c, L * s);
      if (fine) tuft(L * c, L * s, a, r * rng.range(0.14, 0.2));
    }
  }
  ink.stroke(tone(0.16), 0.22, 0.85);
  ink.circle(0, 0, 0.13 * r); ink.fill(tone(0.12));
  if (fine) {
    for (let i = 1; i <= 10; i++) {
      const x = rng.sym(0.08 * r), y = rng.sym(0.08 * r);
      speck(x, y, 0.03 * r, rng.range(0, pi));
    }
    ink.fill(tone(0.04), 0.8);
  }
  const side = or(o.side, () => rng.chance(0.5) ? 1 : -1);
  const ndrift = or(o.drift, () => rng.int(2, 4));
  for (let i = 1; i <= ndrift; i++) {
    const d = r * rng.range(1.3, 2.4);
    const a = (90 - side * rng.range(15, 60)) * rad;
    const x = d * cos(a), y = d * sin(a);
    const tilt = (90 + rng.sym(35)) * rad;
    const l = r * 0.32;
    const tx = x + l * cos(tilt), ty = y + l * sin(tilt);
    ink.moveto(x, y); ink.lineto(tx, ty);
    tuft(tx, ty, tilt, r * 0.17);
    ink.stroke(tone(0.18), 0.2, 0.8);
    ink.push(); ink.translate(x, y); ink.rotate(tilt / rad - 90);
    ink.smooth(ink.blade((v) => [0, -0.12 * r * v], 6, (v) => 0.025 * r * sin(pi * v), (v) => 0.025 * r * sin(pi * v)), true);
    ink.fill(tone(0.1));
    ink.pop();
  }
};

M.tendril = function (rng, s) {
  const pts = [];
  const turns = rng.range(1.6, 2.3);
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const a = t * turns * 2 * pi;
    const r = s * pow(1 - 0.92 * t, 1.6);
    pts.push([r * cos(a) - s, r * sin(a)]);
  }
  M.stem(pts, 0.022, 0.004, tone(0.12));
};

// ---------------------------------------------------------------- accents
M.sparkle = function (rng, r, o) {
  o = o || {};
  const c = or(o.color, () => ink.accent(0));
  const k = 0.12;
  ink.poly([[0, r], [k * r, k * r], [r * 0.75, 0], [k * r, -k * r], [0, -r], [-k * r, -k * r], [-r * 0.75, 0], [-k * r, k * r]], true);
  ink.fill(c);
  if (o.rays !== false) {
    ink.moveto(0, r * 1.15); ink.lineto(0, r * 1.7); ink.moveto(0, -r * 1.15); ink.lineto(0, -r * 1.7);
    ink.stroke(c, 0.2, 0.8);
    ink.circle(0, r * 1.9, r * 0.07); ink.circle(0, -r * 1.9, r * 0.07); ink.fill(c, 0.8);
  }
};

M.rosette = function (rng, r, o) {
  const c = or(o && o.color, () => ink.accent(0));
  for (let k = 0; k <= 3; k++) {
    const a = k * pi / 2 + pi / 4;
    ink.circle(r * 0.5 * cos(a), r * 0.5 * sin(a), r * 0.42);
  }
  ink.stroke(c, 0.22, 0.85);
  ink.circle(0, 0, r * 0.14); ink.fill(c);
  ink.moveto(0, r * 1.05); ink.lineto(0, r * 1.5); ink.moveto(0, -r * 1.05); ink.lineto(0, -r * 1.5);
  ink.stroke(c, 0.2, 0.7);
};

M.hedera = function (rng, s, o) {
  const c = or(o && o.color, () => ink.accent(0));
  ink.push(); ink.scale(s);
  const pts = [];
  for (let i = 0; i <= 47; i++) {
    const t = i / 48 * 2 * pi;
    const x = 16 * pow(sin(t), 3);
    const y = 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t);
    pts.push([x / 17, (y - 5) / 17]);
  }
  ink.push(); ink.rotate(-38);
  ink.smooth(pts, true); ink.fill(c);
  ink.moveto(0, -0.05); ink.curveto(0.02, -0.4, -0.02, -0.8, 0, -1.12);
  ink.moveto(0, -0.35); ink.curveto(0.15, -0.38, 0.3, -0.32, 0.42, -0.22);
  ink.moveto(0, -0.35); ink.curveto(-0.15, -0.38, -0.3, -0.32, -0.42, -0.22);
  ink.stroke(ink.paper, 0.35);
  ink.pop();
  const stem = [[0, 0], [0.12, 0.28], [0.38, 0.42], [0.6, 0.3], [0.52, 0.1], [0.36, 0.2], [0.48, 0.36], [0.85, 0.36], [1.4, 0.3], [2.0, 0.28]];
  M.stem(stem, 0.05, 0.012, c);
  ink.circle(-0.25, 0.42, 0.04); ink.circle(0.95, 0.6, 0.035); ink.circle(0.7, -0.05, 0.03); ink.fill(c, 0.85);
  const r = ink.to_page(2.0, 0.28);
  ink.pop();
  return r;                                   // Lua: return rx, ry
};

// ---------------------------------------------------------------- visitors
function ellipse(cx, cy, rx, ry, n) {
  const pts = [];
  for (let i = 0; i <= n - 1; i++) { const a = 2 * pi * i / n; pts.push([cx + rx * cos(a), cy + ry * sin(a)]); }
  return pts;
}

function wing(rng, pts, t0, rx, ry, spots, fine) {
  ink.smooth(pts, true); ink.fill(tone(t0));
  ink.smooth(pts, true); ink.clip();
  mottle(rng, -1.2, -1.2, 1.2, 1.2, fine ? 9 : 4, 0.14, t0 - 0.2, t0 + 0.2, fine ? 8 : 0);
  ink.smooth(pts, true); ink.stroke(tone(0.05), 0.26 * lod() * ink.CM, ghost() ? 0.25 : 0.55, true);
  for (let i = 1; i <= pts.length; i++) {                 // Lua index
    const p = pts[i - 1];
    const f = rng.range(0.7, 0.88);
    const ex = rx + (p[0] - rx) * f, ey = ry + (p[1] - ry) * f;
    streak3(rx, ry, lerp(rx, ex, 0.3), lerp(ry, ey, 0.4), lerp(rx, ex, 0.7), lerp(ry, ey, 0.75), ex, ey,
      0.035, 0.004, white, rng.range(0.35, 0.6));
    if (spots && fine && i > 1 && i < pts.length) {
      const cx = rx + (p[0] - rx) * 0.9, cy = ry + (p[1] - ry) * 0.9;
      ink.circle(cx, cy, rng.range(0.025, 0.04)); ink.fill(white, 0.8);
    }
  }
  ink.unclip();
}

M.butterfly = function (rng, s, o) {
  o = o || {};
  const open = or(o.open, () => 1);
  ink.push(); ink.scale(s / 2);
  const fine = lod() > 0.3 && !ghost();
  const t0 = or(o.tone, () => rng.range(0.28, 0.4));
  const FW = [[0.05, 0.1], [0.3, 0.45], [0.65, 0.68], [0.92, 0.66], [1.0, 0.5], [0.88, 0.25], [0.55, 0.05], [0.15, -0.02]];
  const HW = [[0.06, -0.02], [0.45, -0.02], [0.72, -0.22], [0.7, -0.5], [0.5, -0.72], [0.25, -0.7], [0.08, -0.35]];
  for (const w of [FW, HW]) for (const p of w) { const a = p[0] + rng.sym(0.03); const b = p[1] + rng.sym(0.03); p[0] = a; p[1] = b; }
  const eye = rng.chance(0.7);
  for (const sx of [-1, 1]) {
    const side = (w) => w.map((p) => [sx * p[0] * open, p[1]]);
    wing(rng, side(HW), t0 + 0.06, sx * 0.04 * open, -0.04, true, fine);
    if (eye && fine) {
      const ex = sx * 0.43 * open, ey = -0.42;
      ink.smooth(ellipse(ex, ey, 0.11 * open, 0.11, 10), true); ink.fill(tone(0.08), 0.85);
      ink.smooth(ellipse(ex, ey, 0.07 * open, 0.07, 10), true); ink.fill(white, 0.85);
      ink.smooth(ellipse(ex, ey, 0.035 * open, 0.035, 8), true); ink.fill(ink.accent(0));
    }
  }
  for (const sx of [-1, 1]) {
    const w = FW.map((p) => [sx * p[0] * open, p[1]]);
    wing(rng, w, t0, sx * 0.04 * open, 0.04, true, fine);
  }
  const hb = (v) => 0.05 * sin(pi * pow(v, 0.7));
  ink.smooth(ink.blade((v) => [0, -0.62 + 0.62 * v], 10, hb, hb), true); ink.fill(tone(0.06));
  ink.smooth(ellipse(0, 0.08, 0.075, 0.13, 10), true); ink.fill(tone(0.04));
  ink.circle(0, 0.27, 0.06); ink.fill(tone(0.04));
  if (fine) {
    for (const sx of [-1, 1]) {
      const ex = sx * rng.range(0.22, 0.3), ey = rng.range(0.78, 0.9);
      ink.moveto(sx * 0.02, 0.31); ink.curveto(sx * 0.05, 0.5, ex * 0.6, ey * 0.9, ex, ey);
      ink.stroke(tone(0.08), 0.35);
      ink.circle(ex, ey, 0.025); ink.fill(tone(0.06));
    }
    streak3(-0.015, -0.55, -0.02, -0.35, -0.02, -0.1, -0.01, 0.0, 0.015, 0.004, white, 0.45);
  }
  ink.pop();
};

M.bee = function (rng, s, o) {
  o = o || {};
  ink.push(); ink.scale(s);
  const fine = lod() > 0.25 && !ghost();
  if (o.trail !== false && !ghost()) {
    const R = 0.32, c = rng.range(0.16, 0.22), turns = rng.range(1.2, 1.6);
    const side = rng.chance(0.5) ? 1 : -1;
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const th = i / 60 * turns * 2 * pi;
      pts.push([side * R * sin(th), -0.62 - c * th + R * (cos(th) - 1) * 0.6]);
    }
    ink.smooth(pts, false);
    ink.stroke(tone(0.18), 0.9, 0.7, false, "[0 2.6] 0");
  }
  const ab = ellipse(0, -0.2, 0.19, 0.3, 16);
  ink.smooth(ab, true); ink.fill(tone(0.38));
  ink.smooth(ab, true); ink.clip();
  for (let k = 0; k <= 2; k++) {
    const y = -0.06 - 0.14 * k;
    ink.poly([[-0.3, y + 0.035], [0, y + 0.06], [0.3, y + 0.035], [0.3, y - 0.035], [0, y - 0.01], [-0.3, y - 0.035]], true);
  }
  ink.fill(tone(0.05), 0.9);
  if (fine) mottle(rng, -0.2, -0.5, 0.2, 0.1, 4, 0.06, 0.2, 0.55, 4);
  ink.smooth(ab, true); ink.stroke(tone(0.05), 0.12 * lod() * ink.CM, 0.4, true);
  streak3(-0.1, -0.38, -0.13, -0.25, -0.12, -0.12, -0.08, 0.0, 0.04, 0.008, white, 0.55);
  ink.unclip();
  ink.poly([[-0.025, -0.48], [0, -0.58], [0.025, -0.48]], true); ink.fill(tone(0.05));
  if (fine) {
    for (const sx of [-1, 1]) {
      for (let k = 0; k <= 2; k++) {
        const y0 = 0.17 - 0.06 * k;
        const ex = sx * rng.range(0.26, 0.32), ey = y0 - 0.12 + 0.08 * (1 - k) + rng.sym(0.03);
        ink.moveto(sx * 0.08, y0); ink.curveto(sx * 0.18, y0 + 0.04, ex * 0.9, ey + 0.05, ex, ey);
      }
    }
    ink.stroke(tone(0.08), 0.35);
  }
  ink.smooth(ink.blob(rng, 0, 0.15, 0.14, 0.13, 0.18, 12), true); ink.fill(tone(0.06));
  if (fine) mottle(rng, -0.14, 0.03, 0.14, 0.28, 3, 0.05, 0.02, 0.3, 6);
  ink.smooth(ellipse(0, 0.33, 0.09, 0.075, 10), true); ink.fill(tone(0.04));
  for (const sx of [-1, 1]) { ink.moveto(sx * 0.03, 0.38); ink.lineto(sx * 0.07, 0.48); ink.lineto(sx * 0.14, 0.53); }
  ink.stroke(tone(0.06), 0.3);
  for (const sx of [-1, 1]) {
    const wls = [[0.5, 0.16, 32], [0.36, 0.12, 52]];
    for (let k = 1; k <= 2; k++) {
      const wl = wls[k - 1];
      ink.push(); ink.translate(sx * 0.07, 0.17 - 0.04 * k); ink.rotate(sx > 0 ? -wl[2] : 180 + wl[2]);
      const w = ellipse(wl[0] / 2, 0, wl[0] / 2, wl[1] / 2, 14);
      ink.smooth(w, true); ink.fill(tone(0.85), 0.55);
      ink.smooth(w, true); ink.stroke(tone(0.15), 0.3, 0.75);
      if (fine) {
        ink.moveto(0.02, 0); ink.curveto(wl[0] * 0.3, 0.02, wl[0] * 0.6, 0.01, wl[0] * 0.85, 0);
        ink.moveto(wl[0] * 0.3, 0.01); ink.lineto(wl[0] * 0.55, wl[1] * 0.4);
        ink.stroke(tone(0.2), 0.2, 0.6);
      }
      ink.pop();
    }
  }
  ink.pop();
};

M.snail = function (rng, s, o) {
  o = o || {};
  ink.push(); ink.scale(s);
  const fine = lod() > 0.25 && !ghost();
  const body = [[0.0, -0.78], [-0.01, -0.3], [0.0, 0.3], [0.04, 0.58], [0.12, 0.7], [0.22, 0.66],
    [0.24, 0.5], [0.2, 0.32], [0.17, 0.0], [0.12, -0.45], [0.05, -0.7]];
  for (const p of body) p[0] = p[0] * (1 + rng.sym(0.08));
  const tb = or(o.tone, () => rng.range(0.5, 0.6));
  ink.smooth(body, true); ink.fill(tone(tb));
  ink.smooth(body, true); ink.clip();
  if (fine) mottle(rng, -0.1, -0.8, 0.3, 0.8, 5, 0.1, tb - 0.25, tb + 0.15, 10);
  ink.moveto(-0.05, -0.8); ink.lineto(-0.05, 0.7); ink.lineto(0.04, 0.7); ink.lineto(0.04, -0.8); ink.close();
  ink.fill(tone(0.15), 0.35, true);
  ink.smooth(body, true); ink.stroke(tone(0.08), 0.1 * lod() * ink.CM, 0.4, true);
  ink.unclip();
  const feel = [[0.17, 0.66, 0.36, 1.02], [0.1, 0.7, 0.18, 1.04], [0.05, 0.68, 0.0, 0.84]];
  for (let k = 1; k <= 3; k++) {
    const f = feel[k - 1];
    ink.moveto(f[0], f[1]); ink.curveto(f[0] + 0.02, f[1] + 0.12, f[2] - 0.04, f[3] - 0.1, f[2], f[3]);
    ink.stroke(tone(0.12), k < 3 ? 0.45 : 0.35);
    if (k < 3) { ink.circle(f[2], f[3], 0.028); ink.fill(tone(0.05)); }
  }
  const cx = 0.36, cy = 0.0, R = 0.42;
  const t0 = rng.range(0.22, 0.32);
  const disc = ink.blob(rng, cx, cy, R, R * 0.96, 0.03, 16);
  ink.smooth(disc, true); ink.fill(tone(t0));
  ink.smooth(disc, true); ink.clip();
  mottle(rng, cx - R, cy - R, cx + R, cy + R, fine ? 7 : 3, 0.1, t0 - 0.18, t0 + 0.22, fine ? 10 : 0);
  const turns = rng.range(2.3, 2.7), ph = rng.range(0, 2 * pi);
  const sp = [], dk = [];
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const a = ph + t * turns * 2 * pi;
    const r = R * 0.95 * pow(t, 1.15);
    sp.push([cx + r * cos(a), cy + r * sin(a)]);
    const r2 = R * 0.95 * pow(max(0, t - 0.12), 1.15);
    dk.push([cx + r2 * cos(a), cy + r2 * sin(a)]);
  }
  ink.smooth(dk, false); ink.stroke(tone(0.05), 0.07 * lod() * ink.CM, 0.6, true);
  ink.smooth(sp, false); ink.stroke(white, 0.05 * lod() * ink.CM, 0.75);
  ink.smooth(disc, true); ink.stroke(tone(0.05), 0.12 * lod() * ink.CM, 0.5, true);
  ink.unclip();
  ink.pop();
};

M.bird = function (rng, s, o) {
  o = o || {};
  ink.push(); ink.scale(or(o.facing, () => 1) * s, s);
  const fine = lod() > 0.3 && !ghost();
  const t0 = or(o.tone, () => rng.range(0.3, 0.38));
  const hw = (v) => 0.055 * pow(sin(pi * pow(v, 0.4)), 0.6);
  for (let k = 1; k <= 4; k++) {
    const L = rng.range(0.42, 0.5);
    ink.push(); ink.translate(-0.26, 0.28); ink.rotate(rng.range(-150, -140) + 7 * k - 90);
    const f = ink.blade((v) => [0, v * L], 10, hw, hw);
    ink.smooth(f, true); ink.fill(tone(0.12 + 0.05 * k));
    ink.smooth(f, true); ink.stroke(tone(0.05), 0.3, 0.5);
    ink.pop();
  }
  const body = [[0.37, 0.56], [0.3, 0.665], [0.15, 0.64], [-0.03, 0.54], [-0.22, 0.4], [-0.31, 0.3],
    [-0.27, 0.22], [-0.08, 0.12], [0.12, 0.12], [0.27, 0.27], [0.35, 0.42]];
  for (const p of body) { const a = p[0] + rng.sym(0.012); const b = p[1] + rng.sym(0.012); p[0] = a; p[1] = b; }
  ink.smooth(body, true); ink.fill(tone(t0));
  ink.smooth(body, true); ink.clip();
  for (let k = 1; k <= 4; k++) {
    ink.smooth(ink.blob(rng, 0.17, 0.27, 0.08 + 0.04 * k, 0.06 + 0.03 * k, 0.2, 9), true);
    ink.fill(white, 0.2);
  }
  mottle(rng, -0.35, 0.1, 0.4, 0.7, fine ? 10 : 4, 0.07, t0 - 0.2, t0 + 0.2, fine ? 10 : 0);
  if (fine) {
    for (let i = 1; i <= 14; i++) {
      const x = rng.range(0.08, 0.3), y = rng.range(0.16, 0.42);
      ink.push(); ink.translate(x, y); ink.rotate(rng.range(-20, 20));
      ink.smooth(ellipse(0, 0, 0.012, 0.022, 6), true);
      ink.pop();
    }
    ink.fill(tone(0.1), 0.7);
  }
  ink.smooth(ink.blob(rng, 0.24, 0.66, 0.15, 0.08, 0.1, 9), true); ink.fill(tone(0.08), 0.6, true);
  ink.smooth(body, true); ink.stroke(tone(0.05), 0.07 * lod() * ink.CM, 0.5, true);
  ink.unclip();
  const wingpts = [[0.17, 0.47], [0.04, 0.52], [-0.12, 0.45], [-0.28, 0.33], [-0.44, 0.22], [-0.35, 0.23],
    [-0.38, 0.19], [-0.26, 0.21], [-0.28, 0.17], [-0.12, 0.23], [0.05, 0.31], [0.15, 0.4]];
  const tw = t0 - 0.1;
  ink.smooth(wingpts, true, 0.8); ink.fill(tone(tw));
  ink.smooth(wingpts, true, 0.8); ink.clip();
  mottle(rng, -0.45, 0.15, 0.2, 0.6, fine ? 6 : 3, 0.07, tw - 0.15, tw + 0.2, 0);
  for (let k = 1; k <= 5; k++) {
    const y = 0.28 + 0.04 * k;
    streak3(0.12, y + 0.05, 0.0, y + 0.03, -0.15, y - 0.03, -0.3 - 0.02 * k, y - 0.1 - 0.01 * k, 0.025, 0.003, white, rng.range(0.45, 0.7));
  }
  ink.smooth(wingpts, true, 0.8); ink.stroke(tone(0.04), 0.06 * lod() * ink.CM, 0.5, true);
  ink.unclip();
  ink.poly([[0.355, 0.585], [0.47, 0.545], [0.36, 0.51]], true); ink.fill(tone(0.05));
  ink.moveto(0.36, 0.548); ink.lineto(0.45, 0.546); ink.stroke(white, 0.2, 0.6);
  ink.circle(0.285, 0.585, 0.03); ink.fill(white, 0.95);
  ink.circle(0.29, 0.585, 0.018); ink.fill(tone(0.03));
  ink.circle(0.284, 0.592, 0.006); ink.fill(white);
  for (const lx of [0.0, 0.08]) {
    ink.moveto(lx + 0.02, 0.14); ink.lineto(lx, 0.0);
    ink.moveto(lx - 0.05, 0.0); ink.lineto(lx + 0.05, 0.005);
  }
  ink.stroke(tone(0.06), 0.45);
  ink.pop();
};

M.ghost = function (level, fn) {
  const old = ink.set_lift(or(level, () => 0.62));
  fn();
  ink.set_lift(old);
};

module.exports = M;
