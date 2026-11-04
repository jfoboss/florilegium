/*! florilegium-garden: the florilegium garden in JS for ePub (a port of the Lua, deterministic math).
 * Original engine: https://github.com/kevinraymond/florilegium. JavaScript port (c) 2026 jfoboss.
 * MIT License
 *
 * Copyright (c) 2026 Kevin Raymond
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (root) {
var defs = {}, cache = {};
function req(n) { n = n.replace(/^\.\//, ""); if (cache[n]) return cache[n].exports;
  var m = { exports: {} }; cache[n] = m; defs[n](m, m.exports, req); return m.exports; }
defs["detmath.js"] = function (module, exports, require) {
// detmath.js — deterministic sin, cos, atan2, log, exp, pow.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
// fdlibm: Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved. Developed at SunSoft, a Sun Microsystems, Inc. business. Permission to use, copy, modify, and distribute this software is freely granted, provided that this notice is preserved.
//
// The built-in Math.sin/cos/pow/log of different engines (V8, JavaScriptCore, glibc
// under texlua) sometimes differ in the last bit. The garden grows greedily,
// and one such difference can send a branch somewhere else. Here the functions
// follow the fdlibm algorithms (Sun Microsystems, 1993) using only +, -, *, /
// and comparisons, which IEEE 754 requires to compute the same everywhere, so
// the result is bit for bit the same in any engine. The Lua copy is detmath.lua;
// the two must agree bit for bit (checked by test/detmath_cross.js).
//
// Not used: Math.fround, FMA, bit operations on doubles.
"use strict";

// ---------------------------------------------------------------- sin / cos
const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03,
  S3 = -1.98412698298579493134e-04, S4 = 2.75573137070700676789e-06,
  S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03,
  C3 = 2.48015872894767294178e-05, C4 = -2.75573143513906633035e-07,
  C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
const INVPIO2 = 6.36619772367581382433e-01;
const PIO2_1 = 1.57079632673412561417e+00;    // first 33 bits of pi/2
const PIO2_1T = 6.07710050650619224932e-11;   // pi/2 - PIO2_1

function ksin(x) {
  const z = x * x, v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x + v * (S1 + z * r);
}
function kcos(x) {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  return 1 - (0.5 * z - z * r);
}
// x = n*pi/2 + y, |y| <= pi/4 (Cody–Waite, pi/2 in two parts; exact for |x| < 2^20)
function reduce(x) {
  const n = Math.floor(x * INVPIO2 + 0.5);
  const y = (x - n * PIO2_1) - n * PIO2_1T;
  return [n - 4 * Math.floor(n / 4), y];      // quadrant 0..3
}
function sin(x) {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  if (x > -0.7853981633974483 && x < 0.7853981633974483) return ksin(x);
  const [q, y] = reduce(x);
  if (q === 0) return ksin(y);
  if (q === 1) return kcos(y);
  if (q === 2) return -ksin(y);
  return -kcos(y);
}
function cos(x) {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  if (x > -0.7853981633974483 && x < 0.7853981633974483) return kcos(x);
  const [q, y] = reduce(x);
  if (q === 0) return kcos(y);
  if (q === 1) return -ksin(y);
  if (q === 2) return -kcos(y);
  return ksin(y);
}

// ---------------------------------------------------------------- atan / atan2
const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01,
  9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17,
  1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01,
  1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02,
  6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02,
  1.62858201153657823623e-02];

function atan(x) {
  if (x !== x) return NaN;
  const neg = x < 0;
  let a = neg ? -x : x;
  if (a >= 7.378697629483821e19) return neg ? -(ATANHI[3] + ATANLO[3]) : ATANHI[3] + ATANLO[3];   // 2^66
  let id;
  if (a < 0.4375) {
    if (a < 1.862645149230957e-9) return x;                                   // 2^-29
    id = -1;
  } else if (a < 1.1875) {
    if (a < 0.6875) { id = 0; a = (2 * a - 1) / (2 + a); }
    else { id = 1; a = (a - 1) / (a + 1); }
  } else if (a < 2.4375) { id = 2; a = (a - 1.5) / (1 + 1.5 * a); }
  else { id = 3; a = -1 / a; }
  const xx = id < 0 ? x : a;
  const z = xx * xx, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return xx - xx * (s1 + s2);
  const r = ATANHI[id] - ((xx * (s1 + s2) - ATANLO[id]) - xx);
  return neg ? -r : r;
}
const PI = 3.1415926535897931160e+00, PI_LO = 1.2246467991473531772e-16;
const PI_O_2 = 1.5707963267948965580e+00;
// atan2(y, x) = math.atan(y, x) in Lua 5.3
function atan2(y, x) {
  if (x !== x || y !== y) return NaN;
  if (x === 1) return atan(y);
  const yneg = y < 0 || (y === 0 && 1 / y < 0);
  const xneg = x < 0 || (x === 0 && 1 / x < 0);
  if (y === 0) return xneg ? (yneg ? -PI : PI) : y;
  if (x === 0) return yneg ? -PI_O_2 : PI_O_2;
  const z = atan(Math.abs(y / x));
  if (!xneg) return yneg ? -z : z;
  return yneg ? (z - PI_LO) - PI : PI - (z - PI_LO);
}

// ---------------------------------------------------------------- log / exp
const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10;
const LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01,
  LG3 = 2.857142874366239149e-01, LG4 = 2.222219843214978396e-01,
  LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01,
  LG7 = 1.479819860511658591e-01;
const SQRT2 = 1.4142135623730951;
const TWO32 = 4294967296;

function log(x) {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let k = 0;                                   // x = m * 2^k, m in [1, 2): dividing by powers of two is exact
  while (x >= TWO32) { x /= TWO32; k += 32; }
  while (x >= 2) { x /= 2; k += 1; }
  while (x < 2.3283064365386963e-10) { x *= TWO32; k -= 32; }   // 2^-32
  while (x < 1) { x *= 2; k -= 1; }
  if (x > SQRT2) { x /= 2; k += 1; }
  const f = x - 1;
  const s = f / (2 + f), z = s * s, w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const R = t2 + t1, hfsq = 0.5 * f * f;
  return k * LN2_HI - ((hfsq - (s * (hfsq + R) + k * LN2_LO)) - f);
}

const INVLN2 = 1.44269504088896338700e+00;
const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03,
  P3 = 6.61375632143793436117e-05, P4 = -1.65339022054652515390e-06,
  P5 = 4.13813679705723846039e-08;
function pow2(k) {                             // 2^k for integer k: exact multiplications only
  let r = 1;
  if (k >= 0) { while (k >= 32) { r *= TWO32; k -= 32; } while (k > 0) { r *= 2; k -= 1; } }
  else { while (k <= -32) { r /= TWO32; k += 32; } while (k < 0) { r /= 2; k += 1; } }
  return r;
}
function exp(x) {
  if (x !== x) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019411) return 0;
  const k = Math.floor(x * INVLN2 + 0.5);
  const hi = x - k * LN2_HI, lo = k * LN2_LO, r = hi - lo;
  const t = r * r;
  const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  const y = 1 - ((lo - (r * c) / (2 - c)) - hi);
  if (k < -1000) return y * pow2(k + 1000) * pow2(-1000);   // no intermediate underflow to zero
  return y * pow2(k);
}

// x ^ y as in Lua (C pow), but the same everywhere
function pow(x, y) {
  if (y === 0) return 1;
  if (x !== x || y !== y) return NaN;
  if (Math.floor(y) === y && y >= -64 && y <= 64) {   // integer power: by repeated multiplication
    let n = y < 0 ? -y : y, r = 1;
    for (let i = 0; i < n; i++) r *= x;
    return y < 0 ? 1 / r : r;
  }
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x < 0) return NaN;
  if (x === 1) return 1;
  return exp(y * log(x));
}

module.exports = { sin, cos, atan, atan2, log, exp, pow };

};
defs["fmt.js"] = function (module, exports, require) {
// fmt.js — numbers as Lua (C printf) prints them, bit for bit.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
"use strict";

// "%.Nf": printf prints the exact decimal value of the binary number,
// rounded to nearest, ties to even. Number.toFixed rounds the same way
// except on an exact tie, where it takes the larger. A tie is only
// possible if x is a multiple of 2^-(N+1) and x * 2^(N+1) is odd;
// this is checked exactly (multiplying by a power of two loses no bits).
const P2 = [2, 4, 8, 16, 32, 64, 128];
function fixed(x, n) {
  if (x !== x) return "-nan";                 // as glibc does for 0/0 in Lua
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  if (x === 0) return (1 / x < 0 ? "-" : "") + (0).toFixed(n);
  const t = x * P2[n];                        // x * 2^(n+1)
  if (Number.isInteger(t) && Math.abs(t) % 2 === 1) {
    // exact tie: |x| * 10^n = k + 1/2, take the even one of k and k+1
    const a = Math.abs(x);
    const lo = a.toFixed(n);                  // toFixed gave k+1 (the larger)
    // k+1 as digits without the point
    const digits = lo.replace(".", "");
    const last = +digits[digits.length - 1];
    let s = lo;
    if (last % 2 === 1) {                     // k+1 is odd -> the even one is k
      s = decDown(lo);
    }
    return (x < 0 ? "-" : "") + s;
  }
  return x.toFixed(n);
}
// decrease a decimal string by one unit in the last place ("0.3" -> "0.2", "1.0" -> "0.9")
function decDown(s) {
  const ch = s.split("");
  for (let i = ch.length - 1; i >= 0; i--) {
    if (ch[i] === ".") continue;
    if (ch[i] === "0") { ch[i] = "9"; continue; }
    ch[i] = String(+ch[i] - 1);
    break;
  }
  let r = ch.join("");
  if (/^0\d/.test(r)) r = r.replace(/^0+(?=\d)/, "");
  return r;
}

module.exports = { fixed };

};
defs["ink.js"] = function (module, exports, require) {
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

};
defs["flora.js"] = function (module, exports, require) {
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

};
defs["grow.js"] = function (module, exports, require) {
// grow.js — a port of florilegium-grow.lua (florilegium, Kevin Raymond, MIT): the grown composition.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
//
// No growth animation (events, schedule, frames): a book page does not need it.
// All generator calls are still in place, including those that in Lua sit in the
// arguments of animation calls and always run (arrive(...) for butterflies and
// bees): otherwise the whole garden would diverge after the first butterfly.
// Themes (geometric, math) and marks from the text (\florilegiumbloom) are not ported.
"use strict";
const ink = require("./ink.js");
const flora = require("./flora.js");
const D_ = require("./detmath.js");

const F = flora;
const { sin, cos, pow } = D_;
const sqrt = Math.sqrt, floor = Math.floor, max = Math.max, min = Math.min, abs = Math.abs;
const pi = Math.PI;
const rad = pi / 180;
const HUGE = Infinity;
const tone = ink.tone;
const dist = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return sqrt(dx * dx + dy * dy); };
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const norm = (x, y) => { const L = sqrt(x * x + y * y); if (L < 1e-9) return [0, 1]; return [x / L, y / L]; };
const deg = (x, y) => D_.atan2(y, x) / rad;

const L_GHOST = 1, L_STEM = 2, L_LEAF = 3, L_AIRY = 4, L_BLOOM = 5, L_ACCENT = 6;
const GRID = 0.2, REACH = 3.0, SMALLEST = 0.36, FILLMIN = 0.17;

// ---------------------------------------------------------------- motifs
// (?? instead of or: summer = 0 for budding in Lua is 0, not "no value")
const motifs = [
  { name: "flower", w: 3, smin: 0.75, smax: 1.3, max: 3, hard: true, layer: L_BLOOM, spring: 0.12, autumn: 0.45,
    r: (s) => 1.0 * s, off: (s) => 0, draw: (rng, s) => F.flower(rng, s) },
  { name: "lily", w: 2, smin: 0.8, smax: 1.25, max: 2, hard: true, layer: L_BLOOM, upright: 0.4, spring: 0.1, autumn: 0.4,
    r: (s) => 0.9 * s, off: (s) => 0.15 * s, draw: (rng, s) => F.lily(rng, s) },
  { name: "blossoms", w: 3, smin: 0.55, smax: 0.85, max: 5, layer: L_BLOOM, upright: 0.5, spring: 0.5, autumn: 0.5,
    r: (s) => s, off: (s) => 0.6 * s,
    draw: (rng, s) => {
      const n = rng.int(2, 4);
      for (let k = 1; k <= n; k++) {
        const a = (k - (n + 1) / 2) * 38 + rng.sym(10);
        const d = s * rng.range(0.45, 0.8) * (k === 1 ? 1 : rng.range(0.85, 1.1));
        const x = d * sin(a * rad), y = d * cos(a * rad);
        ink.moveto(0, 0); ink.curveto(0, d * 0.4, x * 0.6, y * 0.7, x, y); ink.stroke(tone(0.1), 0.35);
        ink.push(); ink.translate(x, y); F.blossom(rng, s * rng.range(0.38, 0.5)); ink.pop();
      }
      if (rng.chance(0.6)) { ink.push(); ink.rotate(rng.sym(50)); ink.scale(0.5 * s); F.bud(rng, 1); ink.pop(); }
    } },
  { name: "cyme", w: 3, smin: 1.0, smax: 2.4, max: 6, layer: L_AIRY, upright: 0.6, spring: 1.3, autumn: 0.7,
    r: (s) => 0.45 * s, off: (s) => 0.5 * s, draw: (rng, s) => F.cyme(rng, s) },
  { name: "sprig", w: 2, smin: 1.2, smax: 2.8, max: 4, layer: L_AIRY, upright: 0.8, spring: 1.2,
    r: (s) => 0.42 * s, off: (s) => 0.5 * s, draw: (rng, s) => F.sprig(rng, s) },
  { name: "umbel", w: 1.5, smin: 0.8, smax: 1.5, max: 3, hard: true, layer: L_AIRY, upright: 1.0, spring: 0.8, autumn: 0.8,
    r: (s) => 0.75 * s, off: (s) => 0.6 * s, draw: (rng, s) => F.umbel(rng, s) },
  { name: "leaf", w: 2, smin: 0.9, smax: 2.0, max: 8, layer: L_LEAF, upright: 0.2, spring: 1.3, autumn: 1.2,
    r: (s) => 0.32 * s, off: (s) => 0.5 * s,
    draw: (rng, s) => { ink.scale(s); const w = rng.range(0.22, 0.3); const depth = rng.chance(0.6) ? rng.range(0.4, 0.8) : 0; F.leaf(rng, { w, depth }); } },
  { name: "bud", w: 1, smin: 0.45, smax: 0.75, max: 5, layer: L_BLOOM, upright: 0.5, spring: 3.5, autumn: 0.3,
    r: (s) => 0.45 * s, off: (s) => 0.5 * s, draw: (rng, s) => F.bud(rng, s) },
  { name: "bells", w: 0.7, smin: 0.6, smax: 0.95, max: 1, hard: true, layer: L_BLOOM, hang: true, spring: 0.5, autumn: 0.6,
    r: (s) => 0.62 * s, off: (s) => 0,
    draw: (rng, s) => {
      F.bell(rng, s);
      ink.moveto(0, 0); ink.curveto(0.15 * s, 0.25 * s, 0.4 * s, 0.25 * s, 0.5 * s, 0.1 * s); ink.stroke(tone(0.1), 0.35);
      ink.push(); ink.translate(0.5 * s, 0.1 * s); F.bell(rng, 0.75 * s); ink.pop();
    } },
  { name: "tendril", w: 0.6, smin: 0.3, smax: 0.5, max: 4, layer: L_AIRY, spring: 2, autumn: 1.3,
    r: (s) => 1.0 * s, off: (s) => 1.0 * s, draw: (rng, s) => { ink.rotate(90); F.tendril(rng, s); } },
  { name: "budding", w: 3, smin: 0.55, smax: 0.9, max: 6, layer: L_BLOOM, upright: 0.6, spring: 1, summer: 0, autumn: 0,
    r: (s) => 0.9 * s, off: (s) => 0.6 * s,
    draw: (rng, s) => {
      const n = rng.int(2, 4);
      for (let k = 1; k <= n; k++) {
        const a = (k - (n + 1) / 2) * 34 + rng.sym(10);
        const d = s * rng.range(0.5, 0.85);
        const x = d * sin(a * rad), y = d * cos(a * rad);
        ink.moveto(0, 0); ink.curveto(0, d * 0.4, x * 0.6, y * 0.7, x, y); ink.stroke(tone(0.1), 0.35);
        ink.push(); ink.translate(x, y); ink.rotate(-a * 0.6); F.bud(rng, s * rng.range(0.45, 0.6)); ink.pop();
      }
    } },
  { name: "seedhead", w: 2, smin: 0.45, smax: 0.75, max: 3, hard: true, layer: L_AIRY, upright: 0.6, spring: 0, summer: 0, autumn: 1,
    r: (s) => 1.05 * s, off: (s) => 0, draw: (rng, s) => F.seedhead(rng, s) },
  { name: "butterfly", w: 0.8, smin: 1.1, smax: 1.5, max: 2, hard: true, layer: L_ACCENT, fly: true,
    r: (s) => 0.5 * s, off: (s) => 0,
    // on the page p = nil -> o = nil (no wingbeat)
    draw: (rng, s, p) => F.butterfly(rng, s, (p === undefined || p === null) ? undefined : { open: 0.3 + 0.7 * abs(cos(p * 5 * pi)) }) },
  { name: "bee", w: 0.8, smin: 0.7, smax: 0.85, max: 2, hard: true, layer: L_ACCENT, fly: true,
    r: (s) => 0.6 * s, off: (s) => 0, draw: (rng, s, p) => F.bee(rng, s, { trail: p === undefined || p === null }) },
];

// ---------------------------------------------------------------- region
const inside = (r, x, y) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
function border(rects, x, y) {
  let best = -1;
  for (const r of rects) {
    if (inside(r, x, y)) {
      let d = HUGE;
      const edges = [[x - r[0], r[0] - 0.05, y], [r[2] - x, r[2] + 0.05, y], [y - r[1], x, r[1] - 0.05], [r[3] - y, x, r[3] + 0.05]];
      for (const e of edges) {
        let open = false;
        for (const o of rects) if (o !== r && inside(o, e[1], e[2])) open = true;
        if (!open && e[0] < d) d = e[0];
      }
      if (d > best) best = d;
    }
  }
  return best;
}

function regions(g, layout) {
  const col = [0.3, 0.45, g.colright, g.ph - 0.5];
  const fx1 = g.textleft + (g.textright - g.textleft) * layout.range(0.42, 0.52);
  const foot = [g.colright - 0.01, 0.4, fx1, min(1.75, g.footy - 0.45)];
  const rects = [col, foot];
  let spill = null;
  if (g.spill === 1 && (g.spilly - 0.8) - (g.ybot + 0.6) > 2.5) {
    spill = [g.colright - 0.01, g.ybot + 0.6, g.textright - 0.2, g.spilly - 0.8];
    rects.push(spill);
  }
  return { rects, col, foot, spill, fx1 };
}

function field(rects) {
  const gx = [], gy = [], free = [], lat = new Map();
  const key = (ix, iy) => ix * 100000 + iy;
  for (const r of rects) {
    for (let ix = floor(r[0] / GRID); ix <= floor(r[2] / GRID); ix++) {
      for (let iy = floor(r[1] / GRID); iy <= floor(r[3] / GRID); iy++) {
        const x = (ix + 0.5) * GRID, y = (iy + 0.5) * GRID;
        const k = key(ix, iy);
        if (!lat.has(k)) {
          const b = border(rects, x, y);
          if (b > 0) { const i = gx.length; gx.push(x); gy.push(y); free.push(b); lat.set(k, i); }
        }
      }
    }
  }
  let maxfree = 0;
  for (let i = 0; i < free.length; i++) if (free[i] > maxfree) maxfree = free[i];
  const f = { x: gx, y: gy, free };
  f.each_near = function (x, y, R, fn) {
    const ix1 = floor((x + R) / GRID), iy0 = floor((y - R) / GRID), iy1 = floor((y + R) / GRID);
    for (let ix = floor((x - R) / GRID); ix <= ix1; ix++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        const i = lat.get(key(ix, iy));
        if (i !== undefined) fn(i);
      }
    }
  };
  f.disc = function (x, y, r, k) {
    if (k === undefined || k === null) k = 0.85;
    f.each_near(x, y, r * k + maxfree, (i) => {
      const d = dist(gx[i], gy[i], x, y) - k * r;
      if (d < free[i]) free[i] = d;
    });
  };
  f.free_at = function (x, y) {
    const i = lat.get(key(floor(x / GRID), floor(y / GRID)));
    return i !== undefined ? free[i] : -1;
  };
  return f;
}

// ---------------------------------------------------------------- page
function page(g) {
  const D = g.density ?? 1;
  const NSTEM = D >= 0.6 ? 3 : D >= 0.25 ? 2 : 1;
  const FOOTER = D >= 0.2;
  const rng = ink.rng(g.seed * 7919 + 13);
  const layout = rng.fork();
  ink.set_transform(ink.page_transform(g.mirror ? g.pw : null));

  const vis = ink.rng(g.seed * 7919 + 101);
  let visiting;
  if (g.visitors === false) visiting = {};
  else {
    const butterfly = vis.chance(0.75), bee = vis.chance(0.6), snail = vis.chance(0.4), bird = vis.chance(0.22);
    visiting = { butterfly, bee, snail, bird };
  }
  if (D < 0.3) { visiting.snail = false; visiting.bird = false; }
  const age = g.age;
  const season = (sp, su, au) => {
    if (age === undefined || age === null) return su;
    if (age < 0.5) return lerp(sp, su, smoothstep(0.1, 0.5, age));
    return lerp(su, au, smoothstep(0.5, 0.9, age));
  };
  const spring = season(1, 0, 0), autumn = season(0, 0, 1);
  const sea = ink.rng(g.seed * 7919 + 211);
  const blooms = [];

  const { rects, col, foot, spill, fx1 } = regions(g, layout);
  const fld = field(rects);
  const gx = fld.x, gy = fld.y, free = fld.free, each_near = fld.each_near, disc = fld.disc, free_at = fld.free_at;
  const sdist = new Array(gx.length).fill(HUGE);

  const spts = [];
  const add_stem_points = function (pts, w0, w1, every) {
    if (every === undefined || every === null) every = 1;
    const n = pts.length;
    for (let i = 1; i <= n; i += every) {                  // Lua index
      const a = pts[max(1, i - 1) - 1], b = pts[min(n, i + 1) - 1];
      const [tx, ty] = norm(b[0] - a[0], b[1] - a[1]);
      const p = pts[i - 1];
      spts.push([p[0], p[1], tx, ty, lerp(w0, w1, (i - 1) / max(1, n - 1))]);
      each_near(p[0], p[1], REACH, (j) => {
        const d = dist(gx[j], gy[j], p[0], p[1]);
        if (d < sdist[j]) sdist[j] = d;
      });
    }
  };
  const nearest_stem = function (x, y) {
    let best = HUGE, bp = null;
    for (const p of spts) {
      const d = dist(x, y, p[0], p[1]);
      if (d < best) { best = d; bp = p; }
    }
    return [bp, best];
  };
  const stem = function (pts, w0, w1, proxy) {
    ink.layer(L_STEM);
    F.stem(pts, w0, w1);
    for (let i = 0; i < pts.length; i += 2) disc(pts[i][0], pts[i][1], proxy ?? 0.1, 1);
  };
  const place = function (layer, x, y, a, fn) {
    ink.layer(layer);
    ink.push(); ink.translate(x, y); ink.rotate(a - 90); fn(); ink.pop();
  };

  // ---------------------------------------------------------- 1. stems
  const root = [layout.range(1.0, 1.6), 0.75];
  const cx = g.colright * 0.47;
  const amp = g.colright * 0.2;
  const mains = [];
  const tops = [g.ph - 2.6];
  tops.push(g.ph * layout.range(0.6, 0.72));
  tops.push(g.ph * layout.range(0.36, 0.48));
  for (let k = 1; k <= NSTEM; k++) {
    const f = ink.fbm1(layout, 2);
    const ph = layout.range(0, 10), lam = layout.range(6, 9);
    const x0 = root[0] + (k - 2) * 0.25;
    const pts = [];
    let y = root[1];
    while (y <= tops[k - 1]) {
      let x = cx + amp * f(y / lam + ph) + (k - 2) * 0.35;
      x = lerp(x0, x, smoothstep(0, 4, y - root[1]));
      x = max(0.9, min(g.colright - 0.9, x));
      pts.push([x, y]);
      y = y + 0.25;
    }
    mains[k] = pts;                                         // mains[1..NSTEM], as in Lua
    const w0 = k === 1 ? 0.085 : 0.065;
    stem(pts, w0, 0.028);
    add_stem_points(pts, w0, 0.028);
  }
  {
    const pts = [];
    const turns = layout.range(1.2, 1.6);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = pi * 0.5 + t * turns * 2 * pi;
      const r = 0.55 * pow(1 - 0.85 * t, 1.3);
      pts.push([root[0] - 0.55 + r * cos(a) * -1, root[1] + 0.05 + r * sin(a)]);
    }
    stem(pts, 0.06, 0.012);
  }
  const footpts = [];
  if (FOOTER) {
    const f = ink.fbm1(layout, 2);
    const ybase = (foot[1] + foot[3]) / 2 - 0.05;
    let x = root[0];
    while (x <= fx1 - 0.3) {
      const u = smoothstep(root[0], root[0] + 1.5, x);
      const y = lerp(root[1] + 0.1, ybase + 0.22 * f(x / 3.5), u);
      footpts.push([x, y]);
      x = x + 0.2;
    }
    stem(footpts, 0.065, 0.01, 0.06);
    add_stem_points(footpts, 0.065, 0.012);
  }
  const leafy = [];
  for (let k = 1; k <= NSTEM; k++) leafy.push({ pts: mains[k], big: true });
  const arcs = [];
  if (spill) {
    const sh = spill[3] - spill[1];
    let nb = max(1, floor(sh / 7));
    if (D < 1) nb = floor(nb * D + 0.5);
    for (let b = 1; b <= nb; b++) {
      const y0 = spill[1] + sh * (b - 0.75) / nb;
      const si = layout.int(1, NSTEM);
      const src = mains[si];
      let best = HUGE, bi = 1;
      for (let i = 1; i <= src.length; i++) { const d = abs(src[i - 1][1] - y0); if (d < best) { best = d; bi = i; } }
      const s0 = src[bi - 1];
      const w = spill[2] - s0[0];
      const x3 = s0[0] + w * layout.range(0.7, 0.88);
      const y3 = min(spill[3] - 1.4, y0 + sh / nb * layout.range(0.35, 0.6));
      const c1y = s0[1] + layout.range(-0.4, 0.8);
      const c2y = y3 + layout.range(-1.2, -0.3);
      const pts = ink.sample(ink.bezier3(s0[0], s0[1], s0[0] + w * 0.25, c1y, x3 - w * 0.3, c2y, x3, y3), floor(w / 0.2));
      const f = ink.fbm1(layout, 2);
      for (let i = 1; i <= pts.length; i++) { const p = pts[i - 1]; const u = (i - 1) / (pts.length - 1); p[1] = p[1] + 0.35 * f(p[0] / 3) * sin(pi * u); }
      stem(pts, 0.06, 0.025);
      add_stem_points(pts, 0.06, 0.025);
      leafy.push({ pts, big: true });
      arcs.push(pts);
    }
  }

  disc(g.colright - 0.5, g.headrule + 0.1, 0.7, 1);

  // ---------------------------------------------------------- 2. terminal flowers and ghosts
  const counts = {};
  for (const m of motifs) counts[m.name] = 0;
  {
    const m1 = mains[1];
    const p = m1[m1.length - 1], q = m1[m1.length - 3];
    const [hx, hy] = norm(p[0] - q[0], p[1] - q[1]);
    const s = min(1.75, g.colright * 0.27);
    const fx = p[0] + hx * 0.2, fy = p[1] + hy * 0.2;
    place(L_BLOOM, fx, fy, 90, () => F.flower(rng.fork(), s));
    disc(fx, fy, 1.05 * s, 0.85);
    blooms.push([fx, fy, s]);
    for (let k = 2; k <= NSTEM; k++) {
      const pts = mains[k];
      const p2 = pts[pts.length - 1], q2 = pts[pts.length - 3];
      const [ax, ay] = norm(p2[0] - q2[0], p2[1] - q2[1]);
      const tip = spring > 0.5 ? "bud" : autumn > 0.5 ? "seedhead" : null;
      if (k === 2) {
        const s2 = layout.range(1.0, 1.2);
        if (tip === "bud") place(L_BLOOM, p2[0], p2[1], deg(ax, ay), () => F.bud(rng.fork(), 0.95 * s2));
        else if (tip === "seedhead") place(L_AIRY, p2[0] + ax * 0.15, p2[1] + ay * 0.15, 90, () => F.seedhead(rng.fork(), 0.75 * s2));
        else place(L_BLOOM, p2[0] + ax * 0.25 * s2, p2[1] + ay * 0.25 * s2, deg(ax, ay), () => F.lily(rng.fork(), s2));
        disc(p2[0] + ax * 0.3 * s2, p2[1] + ay * 0.3 * s2, 0.95 * s2, 0.85);
        counts.lily = counts.lily + 1;
      } else {
        const s3 = layout.range(0.85, 1.0);
        if (tip === "bud") place(L_BLOOM, p2[0], p2[1], deg(ax, ay), () => F.bud(rng.fork(), 0.9 * s3));
        else if (tip === "seedhead") place(L_AIRY, p2[0], p2[1], 90, () => F.seedhead(rng.fork(), 0.75 * s3));
        else { place(L_BLOOM, p2[0], p2[1], 90, () => F.flower(rng.fork(), s3)); blooms.push([p2[0], p2[1], s3]); }
        disc(p2[0], p2[1], s3, 0.85);
        counts.flower = counts.flower + 1;
      }
    }
  }
  for (const pts of arcs) {
    const p = pts[pts.length - 1];
    const s = layout.range(1.0, 1.25);
    place(L_BLOOM, p[0], p[1], 90, () => F.flower(rng.fork(), s));
    disc(p[0], p[1], s, 0.85);
    counts.flower = counts.flower + 1;
    blooms.push([p[0], p[1], s]);
  }
  {
    let ng = layout.int(1, 2);
    if (D < 0.4) ng = 0;
    for (let k = 1; k <= ng; k++) {
      const gxp = g.colright * layout.range(0.35, 0.65);
      const gyp = g.ph * (k === 1 ? layout.range(0.15, 0.3) : layout.range(0.45, 0.6));
      const s = layout.range(1.3, 1.6);
      place(L_GHOST, gxp, gyp, 90, () => F.ghost(0.62, () => F.flower(rng.fork(), s)));
      disc(gxp, gyp, 0.8 * s, 0.6);
    }
  }

  const branch_to = function (S, bx, by, ax, ay, w0) {
    const pts = F.branch_path(layout, S[0], S[1], S[2], S[3], bx, by, ax, ay);
    const d = dist(S[0], S[1], bx, by);
    const w = min(S[4] * 0.7, w0);
    stem(pts, w, max(0.012, w * 0.45), 0.07);
    add_stem_points(pts, w, max(0.012, w * 0.45), 2);
    if (d > 1.0) {
      const nl = d > 2 ? 2 : 1;
      for (let j = 1; j <= nl; j++) {
        const i = floor(pts.length * (0.25 + 0.3 * j / nl));    // Lua index
        const p = pts[i - 1], q = pts[i];
        const a = deg(q[0] - p[0], q[1] - p[1]) + (j % 2 === 0 ? 1 : -1) * layout.range(40, 60);
        const ls = layout.range(0.45, 0.75);
        place(L_LEAF, p[0], p[1], a, () => { ink.scale(ls); F.leaflet(rng.fork()); });
        disc(p[0] + cos(a * rad) * ls * 0.5, p[1] + sin(a * rad) * ls * 0.5, 0.25 * ls, 0.7);
      }
    }
    return pts;
  };

  // marks from the text (\florilegiumbloom, headings) exist only in TeX; none here

  // ---------------------------------------------------------- visitors
  const tangent = function (pts, i) {                      // i is a Lua index
    const a = pts[max(1, i - 1) - 1], b = pts[min(pts.length, i + 1) - 1];
    return norm(b[0] - a[0], b[1] - a[1]);
  };
  if (visiting.snail) {
    const s = vis.range(0.75, 0.9);
    let best = -1, c = null;
    for (let t = 1; t <= 12; t++) {
      const k = vis.int(1, NSTEM);
      const pts = mains[k];
      const i = vis.int(max(10, floor(pts.length * 0.15)), max(11, floor(pts.length * 0.45)));
      const side = vis.chance(0.5) ? 1 : -1;
      // beyond the reference: on a short stem (a low sheet: headpiece, chapter end)
      // Lua would fail on pts[i] = nil; here the snail simply skips this stem
      if (i > pts.length) continue;
      const [tx, ty] = tangent(pts, i);
      const nx = ty * side, ny = -tx * side;
      const f = free_at(pts[i - 1][0] + nx * 0.8 * s, pts[i - 1][1] + ny * 0.8 * s);
      if (f > best) { best = f; c = { k, i, side, nx, ny }; }
    }
    if (c && best > 0.25) {
      const pts = mains[c.k];
      const i0 = max(1, c.i - 8);
      const at = function (e) {
        const j = lerp(i0, c.i, e);
        const j0 = floor(j);
        const j1 = min(pts.length, j0 + 1);
        const p = pts[j0 - 1], q = pts[j1 - 1];
        const [tx, ty] = tangent(pts, j0);
        const u = j - j0;
        return [lerp(p[0], q[0], u) + c.nx * 0.03, lerp(p[1], q[1], u) + c.ny * 0.03, deg(tx, ty)];
      };
      const [x, y, a] = at(1);
      place(L_ACCENT, x, y, a, () => { ink.scale(c.side, 1); F.snail(rng.fork(), s); });
      disc(pts[c.i - 1][0] + c.nx * 0.36 * s, pts[c.i - 1][1] + c.ny * 0.36 * s, 0.5 * s, 1);
      counts.snail = 1;
    }
  }
  if (visiting.bird) {
    const s = vis.range(2.3, 2.7);
    let best = -1, c = null;
    for (let t = 1; t <= 24; t++) {
      const k = vis.int(1, NSTEM);
      const pts = mains[k];
      const i = vis.int(floor(pts.length * 0.25), floor(pts.length * 0.75));
      const p = pts[i - 1];
      if (!p) continue;                                    // beyond the reference, as with the snail
      const dir = vis.chance(0.5) ? 1 : -1;
      const L = vis.range(1.2, 1.7);
      const ex = p[0] + dir * L, ey = p[1] + vis.range(0.05, 0.4);
      const bx = ex - dir * 0.25, by = ey;
      const facing = vis.chance(0.65) ? dir : -dir;
      const cx2 = bx + facing * 0.03 * s, cy2 = by + 0.4 * s;
      const f = min(free_at(cx2, cy2) / (0.36 * s), free_at(bx - facing * 0.35 * s, by + 0.15 * s) / (0.2 * s));
      if (f > best) { best = f; c = { k, i, ex, ey, dir, facing, cx: cx2, cy: cy2 }; }
    }
    if (c && best > 1) {
      const pts = mains[c.k];
      const p = pts[c.i - 1];
      const [tx, ty] = tangent(pts, c.i);
      const twig = F.branch_path(vis, p[0], p[1], tx, ty, c.ex, c.ey, c.dir, 0.1);
      stem(twig, 0.05, 0.02, 0.07);
      add_stem_points(twig, 0.05, 0.02, 2);
      const perch = twig[max(1, floor(twig.length * 0.85)) - 1];
      place(L_ACCENT, perch[0], perch[1], 90, () => F.bird(rng.fork(), s, { facing: c.facing }));
      disc(c.cx, c.cy, 0.36 * s, 0.9);
      disc(perch[0] - c.facing * 0.35 * s, perch[1] + 0.15 * s, 0.2 * s, 0.9);
      counts.bird = 1;
    }
  }

  // ---------------------------------------------------------- 3. leaves at the nodes
  if (FOOTER) leafy.push({ pts: footpts, big: false });
  for (const st of leafy) {
    const pts = st.pts;
    let s = 0;
    let acc = layout.range(0.6, 1.3);
    let side = layout.chance(0.5) ? 1 : -1;
    let total = 0;
    for (let i = 2; i <= pts.length; i++) total = total + dist(pts[i - 1][0], pts[i - 1][1], pts[i - 2][0], pts[i - 2][1]);
    for (let i = 2; i <= pts.length - 4; i++) {           // Lua index
      s = s + dist(pts[i - 1][0], pts[i - 1][1], pts[i - 2][0], pts[i - 2][1]);
      if (s >= acc) {
        const u = s / total;
        acc = acc + (st.big ? layout.range(1.4, 2.2) : lerp(0.55, 1.4, u) * layout.range(0.8, 1.2)) / pow(D, 0.6);
        side = -side;
        const [tx, ty] = norm(pts[i][0] - pts[i - 2][0], pts[i][1] - pts[i - 2][1]);
        const a = deg(tx, ty) + side * layout.range(35, 60);
        const ux = cos(a * rad), uy = sin(a * rad);
        let Lf = st.big ? lerp(2.4, 1.3, pts[i - 1][1] / g.ph) * layout.range(0.85, 1.1) : lerp(0.95, 0.45, u) * layout.range(0.85, 1.1);
        Lf = Lf * season(0.8, 1, 1);
        let ok = false;
        for (let t = 1; t <= 3; t++) {
          const mx = pts[i - 1][0] + ux * Lf * 0.55, my = pts[i - 1][1] + uy * Lf * 0.55;
          if (free_at(mx, my) >= 0.24 * Lf) { ok = true; break; }
          Lf = Lf * 0.75;
        }
        if (ok && Lf > (st.big ? 0.7 : 0.3)) {
          const Lfc = Lf;
          if (st.big) {
            const lobed = layout.chance(0.6);
            const bend = side * layout.range(0.05, 0.3);
            const copper = autumn > 0 && sea.chance(0.35 * autumn);
            place(L_LEAF, pts[i - 1][0], pts[i - 1][1], a, () => {
              const leaf = () => {
                ink.scale(Lfc);
                const r1 = rng.fork();
                const w = layout.range(0.22, 0.3);
                const depth = lobed ? layout.range(0.4, 0.8) : 0;
                F.leaf(r1, { w, depth, bend });
              };
              if (copper) ink.in_accent(leaf); else if (spring > 0) F.ghost(0.3 * spring, leaf); else leaf();
            });
          } else {
            const bend = -side * layout.range(0.1, 0.3);
            place(L_LEAF, pts[i - 1][0], pts[i - 1][1], a, () => { ink.scale(Lfc); F.leaflet(rng.fork(), { bend }); });
          }
          for (const f of [0.3, 0.55, 0.8]) disc(pts[i - 1][0] + ux * Lf * f, pts[i - 1][1] + uy * Lf * f, 0.24 * Lf, 0.85);
        }
      }
    }
  }

  // ---------------------------------------------------------- 4. branches to the largest holes
  let area = 0;
  for (const r of rects) area = area + (r[2] - r[0]) * (r[3] - r[1]);
  const af = max(1, area / 175);
  const caps = {};
  for (const m of motifs) caps[m.name] = m.fly ? floor(m.max * min(1, 2 * D) + 0.5) : floor(m.max * af * D + 0.5);
  let nbranch = 0;
  const NBMAX = D < 1 ? max(1, floor(40 * D)) : HUGE;

  for (let it = 1; it <= 400; it++) {
    let best = -1, bi = -1;
    for (let i = 0; i < gx.length; i++) {
      if (sdist[i] <= REACH) {
        const v = free[i] * layout.range(0.85, 1.15);
        if (v > best) { best = v; bi = i; }
      }
    }
    if (bi < 0 || free[bi] < SMALLEST / sqrt(D) || nbranch >= NBMAX) break;
    const f = free[bi], px = gx[bi], py = gy[bi];
    const elig = [], wts = [];
    let wsum = 0;
    for (const m of motifs) {
      const wt = m.w * season(m.spring ?? 1, m.summer ?? 1, m.autumn ?? 1) / (1 + counts[m.name] / max(1, caps[m.name]));
      const ok = wt > 0 && m.r(m.smin) <= f * 1.05 && (!m.hard || counts[m.name] < caps[m.name]) && (!m.fly || visiting[m.name]);
      if (ok) { elig.push(m); wts.push(wt); wsum = wsum + wt; }
    }
    if (elig.length === 0) { free[bi] = 0; continue; }
    let pick = elig[elig.length - 1], acc = layout.u() * wsum;
    for (let k = 0; k < elig.length; k++) { acc = acc - wts[k]; if (acc <= 0) { pick = elig[k]; break; } }
    let s = pick.smax;
    if (pick.r(s) > f * 0.95) {
      let lo = pick.smin, hi = s;
      for (let t = 1; t <= 20; t++) { const mid = (lo + hi) / 2; if (pick.r(mid) > f * 0.95) hi = mid; else lo = mid; }
      s = lo;
    }
    const [S] = nearest_stem(px, py);
    const [dx, dy] = norm(px - S[0], py - S[1]);
    const [ax, ay] = norm(dx, dy + (pick.upright ?? 0));
    let ox = px - ax * pick.off(s), oy = py - ay * pick.off(s);
    if (pick.hang) { ox = px - dx * 0.2 * s; oy = py + 0.45 * s; }
    nbranch = nbranch + 1;
    if (pick.fly) {
      const a = pick.name === "bee" ? layout.range(0, 360) : 90 + layout.sym(50);
      // the arguments of arrive(...) in Lua are evaluated even without animation: two layout numbers
      layout.range(0, 360); layout.sym(0.8);
      place(pick.layer, px, py, a, () => pick.draw(rng.fork(), s));
    } else {
      if (dist(ox, oy, S[0], S[1]) > 0.12) branch_to(S, ox, oy, pick.hang ? dx : ax, pick.hang ? -0.3 : ay, 0.04);
      const a = pick.hang ? 90 : deg(ax, ay);
      place(pick.layer, ox, oy, a, () => pick.draw(rng.fork(), s));
      if (pick.name === "flower") blooms.push([ox, oy, s]);
    }
    counts[pick.name] = counts[pick.name] + 1;
    disc(px, py, pick.r(s) * (2 - D), 0.85);
  }

  // ---------------------------------------------------------- autumn: falling petals
  if (autumn > 0) {
    for (const b of blooms) {
      const nf = sea.int(0, floor(3 * autumn + 0.5));
      for (let t = 1; t <= nf; t++) {
        let best = 0.16, bx = null, by = null;
        for (let u = 1; u <= 6; u++) {
          const x = b[0] + sea.sym(1.1), y = b[1] - b[2] - sea.range(0.1, 2.2);
          const f = free_at(x, y);
          if (f > best) { best = f; bx = x; by = y; }
        }
        if (bx !== null) {
          const ps = sea.range(0.4, 0.6), pa = sea.range(0, 360), pt = sea.range(0.36, 0.5);
          sea.sym(0.6); sea.sym(0.3);                       // sway, x0: animation only, but always drawn
          place(L_BLOOM, bx, by, pa, () => { ink.scale(ps); F.petal(rng.fork(), { tone: pt, heart: false }); });
          disc(bx, by, 0.22, 1);
        }
      }
    }
  }

  // ---------------------------------------------------------- 5. small holes
  let accents = 0, fills = 0;
  const maxfill = floor(28 * af * D);
  for (let it = 1; it <= 600; it++) {
    let best = -1, bi = -1;
    for (let i = 0; i < gx.length; i++) {
      const v = free[i] * layout.range(0.85, 1.15);
      if (v > best) { best = v; bi = i; }
    }
    if (bi < 0 || free[bi] < FILLMIN / D) break;
    const f = free[bi], px = gx[bi], py = gy[bi];
    const [S, sd] = nearest_stem(px, py);
    if (sd < 0.75 && fills < maxfill) {
      fills = fills + 1;
      const [dx, dy] = norm(px - S[0], py - S[1]);
      const [ax, ay] = norm(dx, dy + 0.4);
      const kind = layout.u();
      if (kind < 0.4) {
        const base = deg(ax, ay);
        const ls = min(0.75, f * 1.6);
        for (let k = -1; k <= 1; k += 2) {
          const a = base + k * layout.range(20, 35);
          place(L_LEAF, S[0], S[1], a, () => { ink.scale(ls * layout.range(0.8, 1)); F.leaflet(rng.fork(), { bend: -k * 0.15 }); });
        }
      } else if (kind < 0.65) {
        const ox = px - ax * f * 0.5, oy = py - ay * f * 0.5;
        ink.layer(L_STEM);
        ink.moveto(S[0], S[1]); ink.curveto(S[0] + S[2] * 0.15, S[1] + S[3] * 0.15, ox - ax * 0.1, oy - ay * 0.1, ox, oy);
        ink.stroke(tone(0.1), 0.4);
        place(L_BLOOM, ox, oy, deg(ax, ay), () => F.bud(rng.fork(), min(0.6, f * 1.7)));
      } else {
        const n = layout.int(2, 4);
        for (let k = 1; k <= n; k++) {
          const qx = px + layout.sym(f * 0.5), qy = py + layout.sym(f * 0.5);
          ink.layer(L_STEM);
          ink.moveto(S[0], S[1]); ink.curveto(S[0] + S[2] * 0.1, S[1] + S[3] * 0.1, (S[0] + qx) / 2, (S[1] + qy) / 2 + 0.05, qx, qy);
          ink.stroke(tone(0.12), 0.25, 0.9);
          place(L_BLOOM, qx, qy, 90, () => { const r1 = rng.fork(); F.floret(r1, min(0.11, f * 0.6) * layout.range(0.8, 1.1)); });
        }
      }
    } else if (sd >= 0.75 && accents < 6 * D && f > 0.22 && px < g.colright) {
      accents = accents + 1;
      if (layout.chance(0.6)) place(L_ACCENT, px, py, 90, () => F.sparkle(rng.fork(), 0.13));
      else place(L_ACCENT, px, py, 90, () => F.rosette(rng.fork(), 0.12));
    }
    disc(px, py, max(f, 0.3), 1);
  }

  // ---------------------------------------------------------- 6. the footer's tail
  if (FOOTER) {
    const e = footpts[footpts.length - 1];
    const x2 = e[0] + layout.range(1.6, 2.2);
    ink.layer(L_ACCENT);
    const c = [e[0], e[1], e[0] + 0.6, e[1] + 0.05, x2 - 0.6, e[1] - 0.05, x2, e[1]];
    ink.moveto(c[0], c[1]); ink.curveto(c[2], c[3], c[4], c[5], c[6], c[7]);
    ink.stroke(ink.accent(0), 0.3, 0.8);
    place(L_ACCENT, x2 + 0.18, e[1], 90, () => F.sparkle(rng.fork(), 0.12, { rays: false }));
    ink.circle(x2 + 0.45, e[1], 0.025); ink.fill(ink.accent(0));
  }

  // assemble: a safety clip a little outside the regions, then the layers. With g.bleed
  // (florilegium-svg.lua's bleed, #27) the sides that lie along the paper's edges move out
  // to the bleed, so nothing is cut by a straight line there; the sides facing the text stay.
  ink.tag(null);
  ink.layer(0);
  for (const r of rects) {
    let x1 = r[0] - 0.25, y1 = r[1] - 0.3, x2 = r[2] + (r === col ? 0.25 : 0.3), y2 = r[3] + 0.3;
    if (g.bleed !== undefined) {
      // a footer band squeezed by a small bottom margin can come out upside down
      // (top below bottom); order it first, or the bleed moves it off the paper
      if (y2 < y1) { const t = y1; y1 = y2; y2 = t; }
      if (r[0] < 1) x1 = -g.bleed;
      if (r[1] < 1) y1 = -g.bleed;
      if (r[2] > g.pw - 1) x2 = g.pw + g.bleed;
      if (r[3] > g.ph - 1) y2 = g.ph + g.bleed;
    }
    ink.poly([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], true);
  }
  ink.clip();
  ink.layer(99);
  ink.unclip();
  let n = 0;
  for (const k of Object.keys(counts)) n = n + counts[k];
  ink.flush();
  return { stats: { motifs: n, counts, stems: spts.length, cells: gx.length } };
}

module.exports = { page, motifs, regions, field };

};
defs["page.js"] = function (module, exports, require) {
// page.js — a port of the needed parts of florilegium-svg.lua and florilegium.lua (florilegium, Kevin Raymond, MIT):
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
// TeX-style lengths, colors as xcolor gives them, page layout, garden, SVG.
// Only the flora theme, default summer, no header (head=false), no author page.
"use strict";
const ink = require("./ink.js");
const grow = require("./grow.js");
const { fixed } = require("./fmt.js");

const floor = Math.floor;
const idiv = (a, b) => floor(a / b);          // Lua integer // for non-negatives
const imod = (a, b) => a - floor(a / b) * b;

// ---------------------------------------------------------------- lengths (TeX scan_dimen)
const UNITS = { pt: [1, 1], mm: [7227, 2540], cm: [7227, 254], in: [7227, 100], bp: [7227, 7200] };
function sp(s) {
  s = String(s);
  const m = s.match(/^\s*([-+]?)(\d*)\.?(\d*)\s*([A-Za-z]*)\s*$/);
  if (!m || m[2] + m[3] === "") throw new Error("florilegium: not a length: '" + s + "'");
  const [, sign, int, frac, unit] = m;
  const u = UNITS[unit === "" ? "mm" : unit];
  if (!u) throw new Error("florilegium: unknown unit '" + unit + "' in '" + s + "'");
  let v = int !== "" ? parseInt(int, 10) : 0, f = 0;
  if (frac !== "") {
    let a = 0;
    for (let k = Math.min(frac.length, 17); k >= 1; k--) a = idiv(a + Number(frac[k - 1]) * 131072, 10);
    f = idiv(a + 1, 2);
  }
  if (u[0] !== 1) {
    const q = idiv(v * u[0], u[1]), r = imod(v * u[0], u[1]);
    f = idiv(u[0] * f + 65536 * r, u[1]);
    v = q + idiv(f, 65536);
    f = imod(f, 65536);
  }
  const n = v * 65536 + f;
  return sign === "-" ? -n : n;
}

// ---------------------------------------------------------------- colors as in xcolor
function print_scaled(s) {
  const out = [String(idiv(s, 65536)), "."];
  let delta = 10;
  s = 10 * imod(s, 65536) + 5;
  do {
    if (delta > 65536) s = s + 0x8000 - 50000;
    out.push(String(idiv(s, 65536)));
    s = 10 * imod(s, 65536); delta = delta * 10;
  } while (!(s <= delta));
  return out.join("");
}
function xcolor(n) {
  const q = idiv(n, 255); let r = imod(n, 255); const digits = [];
  for (let k = 1; k <= 6; k++) { r = r * 10; digits.push(idiv(r, 255)); r = imod(r, 255); }
  let s = sp(q + "." + digits.slice(0, 5).join("") + "pt");
  if (digits[5] > 4) s = s + 1;
  return Number(print_scaled(s).replace(/\.0$/, ""));
}
function html(h) {
  h = String(h).replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("florilegium: not a color (RRGGBB): '" + h + "'");
  return [xcolor(parseInt(h.slice(0, 2), 16)), xcolor(parseInt(h.slice(2, 4), 16)), xcolor(parseInt(h.slice(4, 6), 16))];
}

// ---------------------------------------------------------------- PDF -> SVG
function hex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, floor(Number(v) * 255 + 0.5)));
  return "#" + [c(r), c(g), c(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const num = (t) => t.replace(/\.0$/, "");
const fmtg = (x) => String(Number(x.toPrecision(6)));   // %g for fractions 0..1

function translate(stream, out, id) {
  let st = { fill: "#000000", stroke: "#000000", w: "1", op: 1, mult: false };
  const stack = [];
  let open = 0, args = [], d = [], arr = null, nclip = 0, clip = false;
  const paint = (stroke) => {
    const a = ['<path d="', d.join(""), '"'];
    if (stroke) {
      a.push(' fill="none" stroke="' + st.stroke + '" stroke-width="' + st.w + '"');
      if (st.dash) a.push(' stroke-dasharray="' + st.dash + '"');
      if (st.op < 1) a.push(' stroke-opacity="' + fmtg(st.op) + '"');
    } else {
      a.push(' fill="' + st.fill + '"');
      if (st.op < 1) a.push(' fill-opacity="' + fmtg(st.op) + '"');
    }
    if (st.mult) a.push(' style="mix-blend-mode:multiply"');
    a.push("/>");
    out.push(a.join(""));
  };
  const toks = stream.split(/\s+/);
  for (const t of toks) {
    if (t === "") continue;
    const c = t.charCodeAt(0);
    if (arr) {
      const closed = t.endsWith("]"); const v = closed ? t.slice(0, -1) : t;
      if (v !== "") arr.push(num(v));
      if (closed) { args.push(arr); arr = null; }
    } else if (c === 91) {
      arr = [];
      const r = t.slice(1); const closed = r.endsWith("]"); const v = closed ? r.slice(0, -1) : r;
      if (v !== "") arr.push(num(v));
      if (closed) { args.push(arr); arr = null; }
    } else if ((c >= 48 && c <= 57) || c === 45 || c === 46 || c === 47) {
      args.push(t);
    } else {
      const n = args.length;
      if (t === "m" || t === "l") d.push((t === "m" ? "M" : "L") + num(args[n - 2]) + " " + num(args[n - 1]));
      else if (t === "c") d.push("C" + num(args[n - 6]) + " " + num(args[n - 5]) + " " + num(args[n - 4]) + " " +
        num(args[n - 3]) + " " + num(args[n - 2]) + " " + num(args[n - 1]));
      else if (t === "h") d.push("Z");
      else if (t === "f") { paint(false); d = []; }
      else if (t === "S") { paint(true); d = []; }
      else if (t === "W") clip = true;
      else if (t === "n") {
        if (clip) {
          nclip++;
          const cid = id + "c" + nclip;
          out.push('<clipPath id="' + cid + '"><path d="' + d.join("") + '"/></clipPath><g clip-path="url(#' + cid + ')">');
          open++; clip = false;
        }
        d = [];
      } else if (t === "q") { stack.push({ st: Object.assign({}, st), open }); open = 0; }
      else if (t === "Q") { for (let k = 0; k < open; k++) out.push("</g>"); const s = stack.pop(); st = s.st; open = s.open; }
      else if (t === "rg") st.fill = hex(args[n - 3], args[n - 2], args[n - 1]);
      else if (t === "RG") st.stroke = hex(args[n - 3], args[n - 2], args[n - 1]);
      else if (t === "w") st.w = num(args[n - 1]);
      else if (t === "d") { const a = args[n - 2]; st.dash = (Array.isArray(a) && a.length > 0) ? a.join(" ") : undefined; }
      else if (t === "gs") {
        const m = /^\/flo([am])(\d+)$/.exec(args[n - 1]);
        if (!m) throw new Error("florilegium: unknown graphics state " + args[n - 1]);
        st.op = Number(m[2]) / 100; st.mult = m[1] === "m";
      } else if (t === "J" || t === "j") { /* always round */ }
      else throw new Error("florilegium: cannot translate the PDF operator '" + t + "'");
      args = [];
    }
  }
  for (let k = 0; k < open; k++) out.push("</g>");
  return out;
}

// ---------------------------------------------------------------- layout (florilegium.geometry)
const SP_CM = 2.54 / (72.27 * 65536);
function geometry(dimen) {
  const inch = 2.54;
  const cm = (name) => dimen[name] * SP_CM;
  const g = { pw: cm("paperwidth"), ph: cm("paperheight"), textleft: inch + 0 * SP_CM + cm("oddsidemargin") };
  g.textright = g.textleft + cm("textwidth");
  if (g.pw - g.textright > g.textleft + 0.05) {
    g.mirror = true;
    const tl = g.textleft; g.textleft = g.pw - g.textright; g.textright = g.pw - tl;
  }
  g.ytop = g.ph - inch - cm("topmargin") - cm("headheight") - cm("headsep");
  g.ybot = g.ytop - cm("textheight");
  g.colright = g.textleft - 0.4;
  g.headrule = g.ytop + cm("headsep") - 0.1;
  g.footy = g.ybot - cm("footskip");
  return g;
}

const DEFAULTS = { paper: [ "210mm", "297mm" ], left: "68mm", right: "22mm", top: "32mm", bottom: "30mm",
  headsep: "8mm", headheight: "12pt", footskip: "30pt" };

// o: seed (integer ≥ 1), paper [w, h] (lengths) or "WxH" in mm, left right top bottom headsep headheight
// footskip, textend, season, density, intensity, visitors, ink, accent, background, id.
// Returns { svg, g, stats }.
function page(o) {
  o = Object.assign({}, o || {});
  for (const k of Object.keys(DEFAULTS)) if (o[k] === undefined || o[k] === null) o[k] = DEFAULTS[k];
  let paper = o.paper;
  if (typeof paper === "string") {
    const m = /^(\d+\.?\d*)x(\d+\.?\d*)$/.exec(paper);
    if (!m) throw new Error("florilegium: unknown paper '" + paper + "'");
    paper = [m[1] + "mm", m[2] + "mm"];
  }
  const pg = 1;
  const pw = sp(paper[0]), ph = sp(paper[1]);
  const L = sp(o.left), R = sp(o.right), T = sp(o.top), B = sp(o.bottom);
  const hh = sp(o.headheight), hs = sp(o.headsep), inch = sp("1in");
  const tw = pw - L - R, th = ph - T - B;
  if (tw <= 0 || th <= 0) throw new Error("florilegium: the margins leave no room for the text");
  const dimen = { paperwidth: pw, paperheight: ph, textwidth: tw, textheight: th,
    oddsidemargin: L - inch, topmargin: T - inch - hh - hs, headheight: hh, headsep: hs, footskip: sp(o.footskip) };

  const streams = [];
  ink.set_sink((s) => streams.push(s));
  const [ir, ig, ib] = html(o.ink || "2456C4");
  const [ar, ag, ab] = html(o.accent || "B4662F");
  ink.set_ink(ir, ig, ib); ink.set_accent(ar, ag, ab);
  const fx = Number(o.seed);
  if (!(fx >= 1)) throw new Error("florilegium: a seed is a positive integer");
  const seed = floor(fx) * 7919 + pg * 131;
  let age = o.season;
  if (age === undefined || age === null || age === "summer") age = undefined;
  else if (age === "spring") age = 0;
  else if (age === "autumn") age = 1;
  else { age = Number(age); if (Number.isNaN(age)) throw new Error("florilegium: a season is spring, summer, autumn or 0..1"); }
  const density = o.density !== undefined && o.density !== null && !Number.isNaN(Number(o.density)) ? Number(o.density) : 1;
  const intensity = o.intensity !== undefined && o.intensity !== null && !Number.isNaN(Number(o.intensity)) ? Number(o.intensity) : 1;
  const visitors = o.visitors !== false;

  const g = geometry(dimen);
  let spill = 0, spilly = 0;
  if (o.textend !== undefined && o.textend !== null) { spill = 1; spilly = g.ytop - sp(o.textend) * 2.54 / (72.27 * 65536); }
  g.marks = [];
  g.seed = seed; g.spill = spill; g.spilly = spilly; g.visitors = visitors; g.age = age; g.theme = undefined;
  if (density < 1) g.density = Math.max(0.03, density);
  // bleed (a length, florilegium-svg.lua's --bleed): the garden runs that far past the
  // paper's edges, uncut, and the SVG grows by as much on every side
  const bleed = o.bleed !== undefined && o.bleed !== null ? sp(o.bleed) * 2.54 / (72.27 * 65536) : undefined;
  if (bleed !== undefined) g.bleed = bleed;
  const old = ink.set_pale(0.85 * (1 - Math.max(0, Math.min(1, intensity))));
  let stats;
  try {
    stats = grow.page(g).stats;
  } catch (e) {
    ink.take_recording(); ink.discard(); ink.set_lift(0); ink.set_pale(0);
    throw e;
  } finally {
    ink.set_pale(old);
    ink.set_sink(null);
  }
  ink.set_pale(0);

  const CM = 72 / 2.54;
  const W = g.pw * CM, H = g.ph * CM;
  const id = o.id || ("flo" + floor(Number(o.seed) || 0) + "-");
  const out = [bleed === undefined
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="' + fixed(g.pw * 10, 2) + 'mm" height="' + fixed(g.ph * 10, 2) +
      'mm" viewBox="0 0 ' + fixed(W, 2) + " " + fixed(H, 2) + '">'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="' + fixed((g.pw + 2 * bleed) * 10, 2) + 'mm" height="' +
      fixed((g.ph + 2 * bleed) * 10, 2) + 'mm" viewBox="' + fixed(-bleed * CM, 2) + " " + fixed(-bleed * CM, 2) + " " +
      fixed(W + 2 * bleed * CM, 2) + " " + fixed(H + 2 * bleed * CM, 2) + '">'];
  if (o.background) {
    const h = String(o.background).replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("florilegium: not a color (RRGGBB): '" + h + "'");
    out.push('<rect width="' + fixed(W, 2) + '" height="' + fixed(H, 2) + '" fill="#' + h.toLowerCase() + '"/>');
  }
  out.push('<g transform="matrix(1 0 0 -1 0 ' + fixed(H, 2) + ')" stroke-linecap="round" stroke-linejoin="round">');
  streams.forEach((s, i) => translate(s, out, id + (i + 1)));
  out.push("</g></svg>\n");
  return { svg: out.join("\n"), g, stats };
}

module.exports = { page, sp, xcolor, html, translate, geometry };

};
defs["ornaments.js"] = function (module, exports, require) {
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

};
var O = req("ornaments.js");
root.FlorilegiumGarden = { page: req("page.js").page, band: O.band, tailgarden: O.tailgarden, vignette: O.vignette, tile: O.tile, version: 2 };
})(typeof window !== "undefined" ? window : this);
// shmuc.js — the live part-title page: the act's garden regrows to fit the e-reader page.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
//
// The ePub page carries a static garden (an image in an SVG wrapper) and the act title.
// The script measures the page, grows a garden with the same seed on a sheet of its
// proportions and puts it in place of the image. If scripts are off or something
// breaks, the image stays: the page works fully without the script.
//
// Sheet: height is always 200 mm, width follows the page proportions. At 120:200
// this is exactly the sheet the static image was taken from, and the garden is the same.
// Margins are fractions of the width, as on the static sheet (36/120 left, 12/120 right).
(function () {
  "use strict";
  var F = window.FlorilegiumGarden;
  if (!F || !window.DOMParser || !document.querySelector) return;
  var NS = "http://www.w3.org/2000/svg";
  var PT_MM = 25.4 / 72;
  var H = 200, TOP = 36, BOTTOM = 12, TEXTEND = 50;
  var LABEL_Y = TOP + 22, RULE_Y = TOP + 27.5, NAME_Y = TOP + 36;   // as on the static sheet

  function sheet(w, h) {
    var a = Math.max(0.4, Math.min(1.6, w / h));
    var W = Math.round(H * a);
    var left = Math.round(W * 0.3), right = Math.round(W * 0.1);
    return { W: W, left: left, right: right, textleft: left, textright: W - right };
  }

  // the garden is not cut along the sheet's edges: bleed (florilegium-svg.lua's --bleed, #27),
  // the same 40 bp that make_gardens.py gives the static picture, so both are clipped alike
  var BLEED = "40bp";

  function grow(el, s) {
    var d = el.getAttribute("data-florilegium").split(" ");   // seed ink accent [season] [novisitors]
    var o = { seed: +d[0], ink: d[1], accent: d[2], paper: s.W + "x" + H,
      left: s.left + "mm", right: s.right + "mm", top: TOP + "mm", bottom: BOTTOM + "mm",
      headsep: "0mm", headheight: "0pt", textend: TEXTEND + "mm", bleed: BLEED, id: "flo" + d[0] + "w" + s.W + "-" };
    if (d[3] && d[3] !== "summer") o.season = d[3];
    if (d[4] === "novisitors") o.visitors = false;
    var svg = F.page(o).svg;
    var inner = svg.slice(svg.indexOf("<g transform"), svg.lastIndexOf("</svg>"));
    var doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '"><g class="flo-garden" transform="scale(' + PT_MM + ')">' +
      inner + "</g></svg>", "image/svg+xml");
    var g = doc.documentElement.firstChild;
    if (!g || g.nodeName !== "g") throw new Error("garden: parse");
    return document.importNode(g, true);
  }

  function place(el, s) {
    var tw = s.textright - s.textleft;
    var x = s.textleft + tw * 0.403;
    var half = Math.min(x - s.textleft, s.textright - x) - 1;
    var label = el.querySelector(".flo-label"), rule = el.querySelector(".flo-rule"), name = el.querySelector(".flo-name");
    var fit = function (t, size) {
      if (!t) return;
      t.setAttribute("x", x);
      t.setAttribute("font-size", size);
      try {
        var len = t.getComputedTextLength();
        if (len > 2 * half) t.setAttribute("font-size", (size * 2 * half / len).toFixed(2));
      } catch (e) { /* cannot measure: leave as is */ }
    };
    if (label) { label.setAttribute("y", LABEL_Y); fit(label, 4.8); }
    if (rule) { rule.setAttribute("x1", x - 6); rule.setAttribute("x2", x + 6); rule.setAttribute("y1", RULE_Y); rule.setAttribute("y2", RULE_Y); }
    if (name) { name.setAttribute("y", NAME_Y); fit(name, 4.0); }
  }

  function frame(el, s) {
    var b = null;
    try { b = el.getBBox(); } catch (e) { b = null; }
    var x0 = -15, y0 = -15, x1 = s.W + 15, y1 = H + 15;      // at most 15 mm past the sheet
    if (b && b.width > 0) {
      x0 = Math.max(x0, b.x); y0 = Math.max(y0, b.y);
      x1 = Math.min(x1, b.x + b.width); y1 = Math.min(y1, b.y + b.height);
    }
    var p = 1.5;
    el.setAttribute("viewBox", [x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p].map(function (v) { return v.toFixed(2); }).join(" "));
  }

  // E-reader page: width is the column holding the garden (in a spread that is
  // one page, not the whole window), height is the window minus top and bottom margins.
  function measure(el) {
    var box = el.parentNode && el.parentNode.getBoundingClientRect ? el.parentNode.getBoundingClientRect() : null;
    var w = box && box.width > 80 ? box.width : document.documentElement.clientWidth || window.innerWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var top = box ? Math.max(0, Math.min(box.top + (window.pageYOffset || 0), vh / 4)) : 0;
    var h = vh - 2 * top;
    return { w: w, h: h };
  }

  var done = {};
  function render(el, i) {
    var m = measure(el);
    if (!(m.w > 80 && m.h > 80)) return false;
    var s = sheet(m.w, m.h);
    if (done[i] !== s.W) {
      var g = grow(el, s);
      var old = el.querySelector(".flo-garden"), img = el.querySelector("image");
      el.insertBefore(g, el.firstChild);
      if (old) el.removeChild(old);
      if (img) img.parentNode.removeChild(img);
      place(el, s);
      frame(el, s);
      el.setAttribute("data-florilegium-sheet", s.W + "x" + H);
      done[i] = s.W;
    }
    // the sheet fits the page whole (meet) rather than stretching to the width
    el.style.width = "100%";
    el.style.height = Math.floor(m.h) + "px";
    return true;
  }

  function all() {
    var els = document.querySelectorAll("svg[data-florilegium]");
    for (var i = 0; i < els.length; i++) {
      try { render(els[i], i); }
      catch (e) { if (window.console) console.log("florilegium: " + (e && e.message)); }
    }
  }

  var tries = 0, timer = null;
  function start() {
    // the e-reader may show the page before it has a size
    var el = document.querySelector("svg[data-florilegium]");
    if (!el) return;
    var m = measure(el);
    if (!(m.w > 80 && m.h > 80) && tries++ < 20) {
      setTimeout(start, 150);
      return;
    }
    all();
  }
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(all, 350);
  });
  if (document.readyState === "complete") setTimeout(start, 30);
  else window.addEventListener("load", function () { setTimeout(start, 30); });
})();

// chapter.js — live chapter ornaments: the headpiece regrows to the column width.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
//
// In paginated mode, a quiet garden band (60 mm, sparser and paler than the headpiece)
// goes under the last paragraph if it fits on the page; otherwise the vignette stays.
//
// Markup (written by the book builder):
//   <div class="ch-head"><svg data-florilegium-band="seed ink accent season [novisitors]" ...><image .../></svg></div>
//   <div class="ch-tail"><svg data-florilegium-tail="seed ink accent season [novisitors]" ...><image .../></svg></div>
// The images inside are the fallback: without the script, or on an error, they stay.
//
// One scale for the whole book: the headpiece is an 80 mm high band that takes about a
// third of the screen page; the chapter-end garden is measured with the same millimeters
// per pixel, so the flowers are the same size at the top and at the bottom.
(function () {
  "use strict";
  var F = window.FlorilegiumGarden;
  if (!F || !F.band || !window.DOMParser || !document.querySelector) return;
  var NS = "http://www.w3.org/2000/svg";
  var PT_MM = 25.4 / 72;
  var BAND_H = 80, BAND_SHARE = 0.3;     // mm; share of the page height
  var TAIL_H = 60;                       // mm: the quiet chapter-end band; if it doesn't fit, the vignette

  function data(el, attr) {
    var d = el.getAttribute(attr).split(" ");
    var o = { seed: +d[0], ink: d[1], accent: d[2] };
    if (d[3] && d[3] !== "summer") o.season = d[3];
    if (d[4] === "novisitors") o.visitors = false;
    return o;
  }

  function inset() {
    // the e-reader's top margin: where the page's first block starts
    var first = document.body && document.body.firstElementChild;
    var t = first ? first.getBoundingClientRect().top : 0;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return Math.max(0, Math.min(t + (window.pageYOffset || 0), vh / 4));
  }
  function pageHeight() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return vh - 2 * inset();
  }
  function paginated() {
    var de = document.documentElement, b = document.body;
    var cols = function (el) {
      if (!el) return false;
      var cs = window.getComputedStyle(el);
      var w = cs.columnWidth || cs.webkitColumnWidth, c = cs.columnCount || cs.webkitColumnCount;
      return (w && w !== "auto") || (c && c !== "auto" && c !== "1");
    };
    return cols(de) || cols(b) || de.scrollWidth > window.innerWidth + 20;
  }

  function parse(svg, cls) {
    var inner = svg.slice(svg.indexOf("<g transform"), svg.lastIndexOf("</svg>"));
    var doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '"><g class="' + cls + '" transform="scale(' + PT_MM + ')">' +
      inner + "</g></svg>", "image/svg+xml");
    var g = doc.documentElement.firstChild;
    if (!g || g.nodeName !== "g") throw new Error("garden: parse");
    return document.importNode(g, true);
  }
  function swap(el, g, cls) {
    var old = el.querySelector("." + cls), img = el.querySelector("image");
    el.insertBefore(g, el.firstChild);
    if (old) el.removeChild(old);
    if (img) img.style.display = "none";
  }
  function restore(el, cls) {
    var old = el.querySelector("." + cls), img = el.querySelector("image");
    if (old) el.removeChild(old);
    if (img) img.style.display = "";
  }
  function bboxView(el, W, H, pad) {
    var b = null;
    try { b = el.getBBox(); } catch (e) { b = null; }
    var x0 = -10, y0 = -10, x1 = W + 10, y1 = H + 10;
    if (b && b.width > 0) {
      x0 = Math.max(x0, b.x); y0 = Math.max(y0, b.y);
      x1 = Math.min(x1, b.x + b.width); y1 = Math.min(y1, b.y + b.height);
    }
    return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
  }

  // ---------------------------------------------------------- headpiece
  var heads = {};
  function head(el, i) {
    var box = el.parentNode.getBoundingClientRect();
    var w = box.width, ph = pageHeight();
    if (!(w > 80 && ph > 80)) return;
    var a = Math.max(1.1, Math.min(3.2, w / (BAND_SHARE * ph)));
    var W = Math.round(BAND_H * a);
    if (heads[i] === W) return;
    var g = parse(F.band(Object.assign(data(el, "data-florilegium-band"), { width: W, height: BAND_H, id: "flo-h" + i + "w" + W + "-" })), "flo-band");
    swap(el, g, "flo-band");
    var vb = bboxView(el, W, BAND_H, 1);
    el.setAttribute("viewBox", vb.map(function (v) { return v.toFixed(2); }).join(" "));
    el.style.width = "100%";
    el.style.height = Math.round(w * vb[3] / vb[2]) + "px";
    el.setAttribute("data-florilegium-sheet", W + "x" + BAND_H);
    heads[i] = W;
  }

  // ---------------------------------------------------------- chapter end
  var tails = {};
  function tail(el, i) {
    var box = el.parentNode;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var ph = pageHeight(), top = inset();
    // first the vignette, as without the script: the space left is measured from its place
    if (tails[i]) {
      restore(el, "flo-tail");
      el.setAttribute("viewBox", tails[i].vb);
      el.style.height = ""; el.style.width = "";
      box.classList.remove("ch-tail-garden");
      tails[i] = null;
    }
    if (!paginated()) return;
    var r = box.getBoundingClientRect();
    var rest = vh - top - r.top - 6;
    var k = BAND_H / (BAND_SHARE * ph);              // mm per pixel, as for the headpiece
    if (rest * k < TAIL_H + 4) return;
    // column width: from the tailpiece block stretched to the full column (in paginated
    // mode the body's rectangle spans all the columns at once)
    box.classList.add("ch-tail-garden");
    var colW = box.getBoundingClientRect().width;
    rest = vh - top - box.getBoundingClientRect().top - 6;
    var W = Math.round(colW * k), H = TAIL_H;
    if (rest * k < H + 4 || W < 40) { box.classList.remove("ch-tail-garden"); return; }
    var vbOld = el.getAttribute("viewBox");
    var g = parse(F.tailgarden(Object.assign(data(el, "data-florilegium-tail"), { width: W, height: H, id: "flo-t" + i + "s" + W + "x" + H + "-" })), "flo-tail");
    swap(el, g, "flo-tail");
    // fit to the drawing: the lifted mask lets leaves run past the sheet's edge
    var vb = bboxView(el, W, H, 1);
    el.setAttribute("viewBox", vb.map(function (v) { return v.toFixed(2); }).join(" "));
    el.setAttribute("preserveAspectRatio", "xMidYMin meet");
    el.style.width = "100%";
    el.style.height = Math.floor(Math.min(rest, colW * vb[3] / vb[2])) + "px";
    el.setAttribute("data-florilegium-sheet", W + "x" + H);
    tails[i] = { vb: vbOld };
  }

  function all() {
    var hs = document.querySelectorAll("svg[data-florilegium-band]");
    for (var i = 0; i < hs.length; i++) {
      try { head(hs[i], i); } catch (e) { if (window.console) console.log("florilegium: " + (e && e.message)); }
    }
    var ts = document.querySelectorAll("svg[data-florilegium-tail]");
    for (var j = 0; j < ts.length; j++) {
      try { tail(ts[j], j); } catch (e) { if (window.console) console.log("florilegium: " + (e && e.message)); }
    }
  }

  var tries = 0, timer = null;
  function start() {
    if (!document.querySelector("svg[data-florilegium-band], svg[data-florilegium-tail]")) return;
    if (!(pageHeight() > 80) && tries++ < 20) { setTimeout(start, 150); return; }
    all();
  }
  window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(all, 350); });
  if (document.readyState === "complete") setTimeout(start, 30);
  else window.addEventListener("load", function () { setTimeout(start, 30); });
})();
