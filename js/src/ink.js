// ink.js — a port of florilegium-ink.lua (florilegium, Kevin Raymond, MIT): the drawing core.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
// Geometry is computed here; the output is PDF operators as strings, as in Lua,
// bit for bit (cross-checked by test/ink_cross.js and the whole-page cross-check).
// Points are [x, y] arrays; point lists are plain 0-indexed arrays.
"use strict";
const D = require("./detmath.js");
const { fixed } = require("./fmt.js");

const { sin, cos, pow } = D;
const sqrt = Math.sqrt, floor = Math.floor, abs = Math.abs;
const pi = Math.PI;
const rad = pi / 180;
const CM = 72 / 2.54;
const M = {};
M.CM = CM;

// ---------------------------------------------------------------- random
// mulberry32: the step runs in JS 32-bit arithmetic (Math.imul, >>> 0),
// the same as Lua's 64-bit integers masked with 0xffffffff.
function rng(seed) {
  let s = floor(seed) >>> 0;
  const r = {};
  r.u = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ ((t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0)) >>> 0)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r.u();
  r.sym = (a) => a * (2 * r.u() - 1);
  r.int = (a, b) => a + floor((b - a + 1) * r.u());
  r.chance = (p) => r.u() < p;
  r.pick = (t) => t[floor(t.length * r.u())];          // Lua: t[1 + floor(#t * u)]
  r.normal = () => { const u1 = Math.max(r.u(), 1e-12); return sqrt(-2 * D.log(u1)) * cos(2 * pi * r.u()); };
  r.fork = () => rng(floor(r.u() * 4294967295));
  r.save = () => s;
  r.load = (v) => { s = v; };
  return r;
}
M.rng = rng;

// ---------------------------------------------------------------- noise
M.noise1 = function (rg) {
  const g = new Array(256);
  for (let i = 0; i <= 255; i++) g[i] = rg.sym(1);
  return function (x) {
    const i = floor(x); const f = x - i;
    const a = g[i & 255] * f, b = g[(i + 1) & 255] * (f - 1);
    const u = f * f * (3 - 2 * f);
    return 2 * (a + (b - a) * u);
  };
};
M.fbm1 = function (rg, oct) {
  const ns = [];
  for (let k = 1; k <= oct; k++) ns[k] = M.noise1(rg);
  return function (x) {
    let v = 0, a = 1, f = 1;
    for (let k = 1; k <= oct; k++) { v = v + a * ns[k](x * f + 17 * k); a = a * 0.5; f = f * 2; }
    return v;
  };
};

// ---------------------------------------------------------------- color
const srgb_dec = (c) => c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
const srgb_enc = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1 / 2.4) - 0.055;
const cbrt = (x) => x < 0 ? -(pow(-x, 1 / 3)) : pow(x, 1 / 3);

function rgb_to_oklch(r, g, b) {
  r = srgb_dec(r); g = srgb_dec(g); b = srgb_dec(b);
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, sqrt(A * A + B * B), D.atan2(B, A) / rad];
}
function oklch_to_rgb(L, C, h) {
  const A = C * cos(h * rad), B = C * sin(h * rad);
  const l = pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  if (r < -1e-4 || g < -1e-4 || b < -1e-4 || r > 1.0001 || g > 1.0001 || b > 1.0001) return null;
  const c = (x) => srgb_enc(Math.min(1, Math.max(0, x)));
  return [c(r), c(g), c(b)];
}
function oklch_clamped(L, C, h) {
  const v = oklch_to_rgb(L, C, h);
  if (v) return v;
  let lo = 0, hi = C;
  for (let k = 1; k <= 18; k++) { const mid = (lo + hi) / 2; if (oklch_to_rgb(L, mid, h)) lo = mid; else hi = mid; }
  return oklch_to_rgb(L, lo, h);
}

const STOPS = [
  [0.00, 0.25, 0.105, 6],
  [0.18, 0.35, 0.150, 3],
  [0.38, 0.47, 0.175, 0],
  [0.58, 0.60, 0.145, -3],
  [0.80, 0.77, 0.080, -6],
  [1.00, 0.92, 0.030, -8],
];
const REF_C = 0.175;
let ramp = [];
let hue = 263, chroma_k = 1;
let lift = 0, pale = 0;

function build_ramp() {
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    let k = 0;
    while (STOPS[k + 1][0] < t) k++;
    const a = STOPS[k], b = STOPS[k + 1];
    const u = (t - a[0]) / (b[0] - a[0]);
    const L = a[1] + (b[1] - a[1]) * u;
    const C = (a[2] + (b[2] - a[2]) * u) * chroma_k;
    const h = hue + a[3] + (b[3] - a[3]) * u;
    ramp[i] = oklch_clamped(L, C, h);
  }
}
M.set_ink = function (r, g, b) {
  const [, C, h] = rgb_to_oklch(r, g, b);
  hue = h; chroma_k = Math.max(0.15, Math.min(1.3, C / REF_C));
  build_ramp();
};
M.set_ink(0x24 / 255, 0x56 / 255, 0xC4 / 255);

let accent = [0.71, 0.40, 0.18];
M.set_accent = (r, g, b) => { accent = [r, g, b]; };

M.tone = function (t) {
  t = t + (1 - t) * lift;
  if (pale > 0) t = t + (1 - t) * pale;
  const i = Math.max(0, Math.min(100, floor(t * 100 + 0.5)));
  return ramp[i];
};
const toward_white = (c, v) => [c[0] + (1 - c[0]) * v, c[1] + (1 - c[1]) * v, c[2] + (1 - c[2]) * v];
M.accent = function (k) {
  if (k === undefined || k === null) k = 0;
  let c;
  if (k >= 0) c = toward_white(accent, k);
  else c = [accent[0] * (1 + k), accent[1] * (1 + k), accent[2] * (1 + k)];
  if (pale > 0) c = toward_white(c, pale);
  return c;
};
let accent_ramp = null, accent_key = null;
M.in_accent = function (fn) {
  const key = `${fixed(accent[0], 3)} ${fixed(accent[1], 3)} ${fixed(accent[2], 3)}`;
  const main = ramp;
  if (accent_key !== key) {
    const h0 = hue, c0 = chroma_k;
    const [, C, h] = rgb_to_oklch(accent[0], accent[1], accent[2]);
    ramp = []; hue = h; chroma_k = Math.max(0.15, Math.min(1.3, C / REF_C));
    build_ramp();
    accent_ramp = ramp; accent_key = key; hue = h0; chroma_k = c0;
  }
  ramp = accent_ramp;
  fn();
  ramp = main;
};
M.white = [1, 1, 1];
M.paper = [0.995, 0.993, 0.985];
M.set_lift = (v) => { const old = lift; lift = v; return old; };
M.get_lift = () => lift;
M.set_pale = (v) => { const old = pale; pale = v; return old; };

// ---------------------------------------------------------------- transforms
let T = [CM, 0, 0, CM, 0, 0];
let stack = [];
M.set_transform = (t) => { T = t; };
M.page_transform = (mirror) => (mirror !== undefined && mirror !== null && mirror !== false)
  ? [-CM, 0, 0, CM, mirror * CM, 0] : [CM, 0, 0, CM, 0, 0];
M.get_transform = () => T;
M.push = () => { stack.push(T); };
M.pop = () => { T = stack.pop(); };
M.translate = (x, y) => { T = [T[0], T[1], T[2], T[3], T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]]; };
M.rotate = function (deg) {
  const c = cos(deg * rad), s = sin(deg * rad);
  T = [T[0] * c + T[2] * s, T[1] * c + T[3] * s, -T[0] * s + T[2] * c, -T[1] * s + T[3] * c, T[4], T[5]];
};
M.scale = (sx, sy) => { if (sy === undefined || sy === null) sy = sx; T = [T[0] * sx, T[1] * sx, T[2] * sy, T[3] * sy, T[4], T[5]]; };
M.unit = () => sqrt(abs(T[0] * T[3] - T[1] * T[2])) / CM;
M.to_page = (x, y) => [(T[0] * x + T[2] * y + T[4]) / CM, (T[1] * x + T[3] * y + T[5]) / CM];

// ---------------------------------------------------------------- output
let layers = new Map(), cur = 5;
let tags = new Map(), tag = null, recording = false;
function put(s) {
  let b = layers.get(cur);
  if (!b) { b = []; layers.set(cur, b); tags.set(cur, []); }
  b.push(s);
  if (recording) tags.get(cur)[b.length - 1] = tag;
}
M.layer = (n) => { const old = cur; cur = n; return old; };
M.tag = (t) => { const old = tag; tag = t; return old; };
M.record = (on) => { recording = on; tag = null; };

function gs(op, mult) {
  op = floor(op * 100 + 0.5);
  if (op >= 100 && !mult) return null;
  return `flo${mult ? "m" : "a"}${op}`;
}

function P(x, y) {
  return fixed(T[0] * x + T[2] * y + T[4], 1) + " " + fixed(T[1] * x + T[3] * y + T[5], 1);
}
let path = [];
M.moveto = (x, y) => { path.push(P(x, y) + " m"); };
M.lineto = (x, y) => { path.push(P(x, y) + " l"); };
M.curveto = (x1, y1, x2, y2, x3, y3) => { path.push(P(x1, y1) + " " + P(x2, y2) + " " + P(x3, y3) + " c"); };
M.close = () => { path.push("h"); };
M.poly = function (pts, closed) {
  path.push(P(pts[0][0], pts[0][1]) + " m");
  for (let i = 1; i < pts.length; i++) path.push(P(pts[i][0], pts[i][1]) + " l");
  if (closed) path.push("h");
};
M.smooth = function (pts, closed, tension) {
  const n = pts.length;
  if (n < 3) return M.poly(pts, closed);
  const k = (tension === undefined || tension === null ? 1 : tension) / 6;
  const at = (i) => closed ? pts[(((i - 1) % n) + n) % n] : pts[Math.max(1, Math.min(n, i)) - 1];   // i is a Lua index
  path.push(P(pts[0][0], pts[0][1]) + " m");
  const last = closed ? n : n - 1;
  for (let i = 1; i <= last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    path.push(P(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k) + " " +
      P(p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k) + " " + P(p2[0], p2[1]) + " c");
  }
  if (closed) path.push("h");
};
M.circle = function (x, y, r) {
  const k = 0.5523 * r;
  path.push(P(x + r, y) + " m " + P(x + r, y + k) + " " + P(x + k, y + r) + " " + P(x, y + r) + " c " +
    P(x - k, y + r) + " " + P(x - r, y + k) + " " + P(x - r, y) + " c " +
    P(x - r, y - k) + " " + P(x - k, y - r) + " " + P(x, y - r) + " c " +
    P(x + k, y - r) + " " + P(x + r, y - k) + " " + P(x + r, y) + " c h");
};
function take() { const s = path.join(" "); path = []; return s; }
const rgbop = (c, stroke) => `${fixed(c[0], 3)} ${fixed(c[1], 3)} ${fixed(c[2], 3)} ${stroke ? "RG" : "rg"}`;

M.fill = function (c, op, mult) {
  const g = gs(op === undefined || op === null ? 1 : op, mult);
  if (g) put("q /" + g + " gs " + rgbop(c) + " " + take() + " f Q");
  else put(rgbop(c) + " " + take() + " f");
};
M.stroke = function (c, w, op, mult, dash) {
  const g = gs(op === undefined || op === null ? 1 : op, mult);
  const s = rgbop(c, true) + " " + fixed(w, 2) + " w " + (dash ? dash + " d " : "") + take() + " S";
  if (g) put("q /" + g + " gs " + s + " Q"); else put("q " + s + " Q");
};
M.clip = () => { put("q " + take() + " W n"); };
M.unclip = () => { put("Q"); };
M.discard = () => { path = []; };
M.flood = function (c, x0, y0, x1, y1) {
  M.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
  M.fill(c);
};

// Output: Lua writes a literal into a TeX node; here it goes to the sink(s)
let sink = null;
M.set_sink = (fn) => { sink = fn; };
function literal(parts) {
  if (parts.length === 0) return 0;
  const s = "q 1 J 1 j\n" + parts.join("\n") + "\nQ";
  if (sink) sink(s);
  return s.length;
}
const sorted_keys = () => Array.from(layers.keys()).sort((a, b) => a - b);
M.flush = function () {
  const parts = [];
  for (const k of sorted_keys()) parts.push(layers.get(k).join("\n"));
  layers = new Map(); tags = new Map();
  return literal(parts);
};
M.take_recording = function () {
  const rec = { keys: sorted_keys(), layers, tags };
  layers = new Map(); tags = new Map(); recording = false; tag = null;
  return rec;
};
M.emit = function (rec, keep) {
  const parts = [];
  for (const k of rec.keys) {
    const L = rec.layers.get(k), Tg = rec.tags.get(k), out = [];
    for (let i = 0; i < L.length; i++) {
      const t = Tg[i];
      if (t === undefined || t === null || keep(t)) out.push(L[i]);
    }
    if (out.length > 0) parts.push(out.join("\n"));
  }
  return literal(parts);
};

// ---------------------------------------------------------------- geometry
function normals(pts) {
  const n = pts.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let L = sqrt(dx * dx + dy * dy);
    if (L < 1e-9) L = 1;
    out[i] = [-dy / L, dx / L];
  }
  return out;
}
M.normals = normals;

// Lua: local s, L = ink.arclen(pts). Here: s (s[i] is the length up to point i, s[0] = 0),
// the total length is s.total, so a call inside an argument list, where Lua keeps
// only the first value, works too.
M.arclen = function (pts) {
  const s = [0];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc = acc + sqrt(pow(pts[i][0] - pts[i - 1][0], 2) + pow(pts[i][1] - pts[i - 1][1], 2));
    s[i] = acc;
  }
  s.total = acc;
  return s;
};

M.ribbon = function (pts, width) {
  const nrm = normals(pts);
  const s = M.arclen(pts), L = s.total;
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const w = width(L > 0 ? s[i] / L : 0) / 2;
    left.push([p[0] + nrm[i][0] * w, p[1] + nrm[i][1] * w]);
    right.push([p[0] - nrm[i][0] * w, p[1] - nrm[i][1] * w]);
  }
  const out = left;
  for (let i = right.length - 1; i >= 0; i--) out.push(right[i]);
  return out;
};

M.taper = function (x0, y0, x1, y1, x2, y2, x3, y3, w0, w1) {
  const nrm = (dx, dy) => { const L = sqrt(dx * dx + dy * dy); if (L < 1e-9) return [0, 0]; return [-dy / L, dx / L]; };
  const [n0x, n0y] = nrm(x1 - x0, y1 - y0);
  const [n1x, n1y] = nrm(x2 - x0, y2 - y0);
  const [n2x, n2y] = nrm(x3 - x1, y3 - y1);
  const [n3x, n3y] = nrm(x3 - x2, y3 - y2);
  const h0 = w0 / 2, h1 = (2 * w0 + w1) / 6, h2 = (w0 + 2 * w1) / 6, h3 = w1 / 2;
  path.push(P(x0 + n0x * h0, y0 + n0y * h0) + " m " +
    P(x1 + n1x * h1, y1 + n1y * h1) + " " + P(x2 + n2x * h2, y2 + n2y * h2) + " " + P(x3 + n3x * h3, y3 + n3y * h3) + " c " +
    P(x3 - n3x * h3, y3 - n3y * h3) + " l " +
    P(x2 - n2x * h2, y2 - n2y * h2) + " " + P(x1 - n1x * h1, y1 - n1y * h1) + " " + P(x0 - n0x * h0, y0 - n0y * h0) + " c h");
};

M.catmull = function (pts, per) {
  const out = [], n = pts.length;
  for (let i = 1; i <= n - 1; i++) {                      // i is a Lua index
    const p0 = pts[Math.max(i - 1, 1) - 1], p1 = pts[i - 1], p2 = pts[i], p3 = pts[Math.min(i + 2, n) - 1];
    for (let k = 0; k <= per - 1; k++) {
      const t = k / per; const t2 = t * t, t3 = t * t * t;
      const c = (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([c(0), c(1)]);
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
};

M.sample = function (f, n, v0, v1) {
  if (v0 === undefined || v0 === null) v0 = 0;
  if (v1 === undefined || v1 === null) v1 = 1;
  const out = [];
  for (let i = 0; i <= n; i++) { const p = f(v0 + (v1 - v0) * i / n); out.push([p[0], p[1]]); }   // like { x, y } in Lua: a new point
  return out;
};

M.bezier3 = function (x0, y0, x1, y1, x2, y2, x3, y3) {
  return function (v) {
    const u = 1 - v;
    const a = u * u * u, b = 3 * u * u * v, c = 3 * u * v * v, d = v * v * v;
    return [a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3];
  };
};

// Lua: local out, c, nrm = ink.blade(...). Here: out, with c and nrm as properties out.c, out.nrm
M.blade = function (spine, n, wl, wr, edge) {
  const c = M.sample(spine, n);
  const nrm = normals(c);
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    let el = 0, er = 0;
    if (edge) { el = edge(v, 1); er = edge(v, -1); }
    let a = wl(v) + el, b = wr(v) + er;
    if (a < 0) a = 0;
    if (b < 0) b = 0;
    left[i] = [c[i][0] + nrm[i][0] * a, c[i][1] + nrm[i][1] * a];
    right[i] = [c[i][0] - nrm[i][0] * b, c[i][1] - nrm[i][1] * b];
  }
  const out = [];
  for (let i = 0; i <= n; i++) out.push(left[i]);
  for (let i = n - 1; i >= 1; i--) out.push(right[i]);
  out.c = c; out.nrm = nrm;
  return out;
};

M.blob = function (rg, x, y, rx, ry, rough, n) {
  if (n === undefined || n === null) n = 9;
  const ph = rg.range(0, 2 * pi), ph2 = rg.range(0, 2 * pi), rot = rg.range(0, 2 * pi);
  const out = [];
  for (let i = 0; i <= n - 1; i++) {
    const a = 2 * pi * i / n;
    const k = 1 + rough * (0.6 * sin(2 * a + ph) + 0.4 * sin(3 * a + ph2)) + rough * 0.5 * rg.sym(1);
    const px = rx * k * cos(a), py = ry * k * sin(a);
    out.push([x + px * cos(rot) - py * sin(rot), y + px * sin(rot) + py * cos(rot)]);
  }
  return out;
};

module.exports = M;
