
// cosmos.js — самостоятельная книжная тема: звёздные атласы, орбиты, планеты,
// редкие корабли и очень редкие злые кальмары. Никакой флоры и никаких вызовов
// grow/flora. Координаты рисунка — сантиметры, начало слева снизу.
"use strict";
const ink = require("../src/ink.js");
const D = require("../src/detmath.js");
const { sin, cos } = D;
const pi = Math.PI, rad = pi / 180;
const tone = ink.tone;
// Небесная глубина: крупные тела действительно закрывают задние созвездия.
// Подложка совпадает с бумагой пробы и ставится только под силуэт тела.
const PAPER = [246 / 255, 241 / 255, 231 / 255];
function occultPoly(pts) { ink.poly(pts, true); ink.fill(PAPER, 1); }
function occultCircle(x, y, r) { ink.circle(x, y, r); ink.fill(PAPER, 1); }
function occultEllipse(x, y, rx, ry, angle) {
  const a = (angle || 0) * rad, ca = cos(a), sa = sin(a), pts = [];
  for (let i = 0; i < 48; i++) {
    const t = 2 * pi * i / 48, u = rx * cos(t), v = ry * sin(t);
    pts.push([x + u * ca - v * sa, y + u * sa + v * ca]);
  }
  occultPoly(pts);
}
// J2000: Stellarium Western (open skyculture data), HIP stars + stars.6.json.
// Линии созвездий сохраняют пропорции; RA корректно развёрнуто через 0°/360°.
const ZODIAC_ORDER = ["Ari","Tau","Gem","Cnc","Leo","Vir","Lib","Sco","Sgr","Cap","Aqr","Psc"];
const ZODIAC = {
"Ari":{"paths":[[[0.08,0.757],[0.717,0.51195]],[[0.717,0.51195],[0.90349,0.34069]],[[0.90349,0.34069],[0.92,0.243]]],"stars":[[0.08,0.757,3.61],[0.717,0.51195,2.01],[0.90349,0.34069,2.64],[0.92,0.243,3.88]]},
"Tau":{"paths":[[[0.15179,0.76098],[0.43034,0.61034]],[[0.43034,0.61034],[0.51652,0.50966]],[[0.47033,0.43845],[0.08,0.56197]],[[0.57232,0.41494],[0.55245,0.46599]],[[0.57232,0.41494],[0.69318,0.3313]],[[0.69318,0.3313],[0.92,0.23902]],[[0.47033,0.43845],[0.51652,0.50966]],[[0.47033,0.43845],[0.51623,0.42143]],[[0.51623,0.42143],[0.57232,0.41494]],[[0.51652,0.50966],[0.53629,0.47626]],[[0.53629,0.47626],[0.55245,0.46599]],[[0.55245,0.46599],[0.76602,0.63957]]],"stars":[[0.15179,0.76098,1.65],[0.43034,0.61034,4.27],[0.51652,0.50966,3.53],[0.47033,0.43845,0.87],[0.08,0.56197,2.97],[0.57232,0.41494,3.65],[0.55245,0.46599,3.77],[0.69318,0.3313,3.41],[0.92,0.23902,3.61],[0.51623,0.42143,3.4],[0.53629,0.47626,4.3],[0.76602,0.63957,3.62]]},
"Gem":{"paths":[[[0.64117,0.24485],[0.42205,0.39625]],[[0.42205,0.39625],[0.28912,0.44751]],[[0.28912,0.44751],[0.30597,0.24997]],[[0.30597,0.24997],[0.57826,0.11766]],[[0.28912,0.44751],[0.15797,0.62586]],[[0.15797,0.62586],[0.08721,0.53519]],[[0.15797,0.62586],[0.08,0.6669]],[[0.15797,0.62586],[0.24261,0.65862]],[[0.24261,0.65862],[0.36369,0.74744]],[[0.36369,0.74744],[0.16897,0.80709]],[[0.36369,0.74744],[0.51602,0.88234]],[[0.36369,0.74744],[0.58953,0.56181]],[[0.58953,0.56181],[0.71379,0.38325]],[[0.58953,0.56181],[0.76361,0.46679]],[[0.76361,0.46679],[0.83071,0.46654]],[[0.83071,0.46654],[0.92,0.49401]]],"stars":[[0.64117,0.24485,1.93],[0.42205,0.39625,4.01],[0.28912,0.44751,3.5],[0.30597,0.24997,3.58],[0.57826,0.11766,3.35],[0.15797,0.62586,4.06],[0.08721,0.53519,3.57],[0.08,0.6669,1.16],[0.24261,0.65862,3.78],[0.36369,0.74744,4.41],[0.16897,0.80709,1.58],[0.51602,0.88234,3.6],[0.58953,0.56181,3.06],[0.71379,0.38325,4.13],[0.76361,0.46679,2.87],[0.83071,0.46654,3.31],[0.92,0.49401,4.16]]},
"Cnc":{"paths":[[[0.40697,0.92],[0.44148,0.6071]],[[0.44148,0.6071],[0.6764,0.85382]],[[0.44148,0.6071],[0.42733,0.46488]],[[0.42733,0.46488],[0.71231,0.08]],[[0.42733,0.46488],[0.28769,0.19467]]],"stars":[[0.40697,0.92,4.03],[0.44148,0.6071,4.66],[0.6764,0.85382,5.13],[0.42733,0.46488,3.94],[0.71231,0.08,3.53],[0.28769,0.19467,4.26]]},
"Leo":{"paths":[[[0.08,0.37255],[0.31739,0.3973]],[[0.31739,0.3973],[0.76646,0.29735]],[[0.76646,0.29735],[0.77355,0.43579]],[[0.77355,0.43579],[0.68737,0.52466]],[[0.68737,0.52466],[0.31829,0.54436]],[[0.31829,0.54436],[0.08,0.37255]],[[0.68737,0.52466],[0.70975,0.62789]],[[0.70975,0.62789],[0.87287,0.70265]],[[0.87287,0.70265],[0.92,0.63819]],[[0.31829,0.54436],[0.31739,0.3973]]],"stars":[[0.08,0.37255,2.14],[0.31739,0.3973,3.33],[0.76646,0.29735,1.36],[0.77355,0.43579,3.48],[0.68737,0.52466,2.01],[0.31829,0.54436,2.56],[0.70975,0.62789,3.43],[0.87287,0.70265,3.88],[0.92,0.63819,2.97]]},
"Vir":{"paths":[[[0.92,0.62352],[0.7672,0.48722]],[[0.7672,0.48722],[0.66015,0.47488]],[[0.66015,0.47488],[0.45744,0.29396]],[[0.45744,0.29396],[0.23531,0.31049]],[[0.23531,0.31049],[0.22079,0.3901]],[[0.22079,0.3901],[0.09485,0.39648]],[[0.45744,0.29396],[0.4132,0.49078]],[[0.4132,0.49078],[0.28769,0.53065]],[[0.28769,0.53065],[0.08,0.53715]],[[0.4132,0.49078],[0.59523,0.56517]],[[0.59523,0.56517],[0.56462,0.70604]],[[0.59523,0.56517],[0.66015,0.47488]]],"stars":[[0.92,0.62352,4.04],[0.7672,0.48722,5.9],[0.66015,0.47488,2.74],[0.45744,0.29396,0.98],[0.23531,0.31049,4.18],[0.22079,0.3901,4.07],[0.09485,0.39648,3.87],[0.4132,0.49078,3.38],[0.28769,0.53065,4.23],[0.08,0.53715,3.73],[0.59523,0.56517,3.39],[0.56462,0.70604,2.85]]},
"Lib":{"paths":[[[0.10129,0.53187],[0.33311,0.63435]],[[0.33311,0.63435],[0.56771,0.92]],[[0.56771,0.92],[0.89871,0.56819]],[[0.89871,0.56819],[0.73159,0.08]],[[0.73159,0.08],[0.33311,0.63435]]],"stars":[[0.10129,0.53187,4.13],[0.33311,0.63435,3.91],[0.56771,0.92,2.61],[0.89871,0.56819,2.75],[0.73159,0.08,3.25]]},
"Sco":{"paths":[[[0.19949,0.29993],[0.13342,0.23088]],[[0.13342,0.23088],[0.0955,0.19156]],[[0.0955,0.19156],[0.17188,0.08865]],[[0.17188,0.08865],[0.35912,0.08]],[[0.35912,0.08],[0.49422,0.11144]],[[0.49422,0.11144],[0.51003,0.2661]],[[0.51003,0.2661],[0.52273,0.40068]],[[0.52273,0.40068],[0.62898,0.61852]],[[0.62898,0.61852],[0.67716,0.68247]],[[0.67716,0.68247],[0.89347,0.81905]],[[0.67716,0.68247],[0.9045,0.69386]],[[0.67716,0.68247],[0.8555,0.92]]],"stars":[[0.19949,0.29993,1.62],[0.13342,0.23088,2.39],[0.0955,0.19156,2.99],[0.17188,0.08865,1.86],[0.35912,0.08,3.32],[0.49422,0.11144,4.7],[0.51003,0.2661,3],[0.52273,0.40068,2.29],[0.62898,0.61852,2.82],[0.67716,0.68247,1.06],[0.89347,0.81905,2.29],[0.9045,0.69386,2.89],[0.8555,0.92,2.56]]},
"Sgr":{"paths":[[[0.71212,0.54257],[0.66874,0.66799]],[[0.73305,0.3452],[0.69236,0.41287]],[[0.69236,0.41287],[0.80654,0.5256]],[[0.80654,0.5256],[0.92,0.59942]],[[0.80654,0.5256],[0.71212,0.54257]],[[0.71212,0.54257],[0.69236,0.41287]],[[0.69236,0.41287],[0.45335,0.54109]],[[0.45335,0.54109],[0.55877,0.62333]],[[0.55877,0.62333],[0.71212,0.54257]],[[0.55877,0.62333],[0.66874,0.66799]],[[0.66874,0.66799],[0.75708,0.79218]],[[0.45335,0.54109],[0.42644,0.60399]],[[0.42644,0.60399],[0.49903,0.64309]],[[0.49903,0.64309],[0.55877,0.62333]],[[0.49903,0.64309],[0.4837,0.79082]],[[0.4837,0.79082],[0.44047,0.77275]],[[0.44047,0.77275],[0.35994,0.85213]],[[0.35994,0.85213],[0.33483,0.8836]],[[0.42644,0.60399],[0.24558,0.68799]],[[0.24558,0.68799],[0.08,0.60286]],[[0.08,0.60286],[0.09817,0.38748]],[[0.09817,0.38748],[0.12599,0.19984]],[[0.12599,0.19984],[0.32107,0.23549]],[[0.12599,0.19984],[0.32522,0.1164]]],"stars":[[0.71212,0.54257,2.72],[0.66874,0.66799,2.82],[0.73305,0.3452,3.1],[0.69236,0.41287,1.79],[0.80654,0.5256,2.98],[0.92,0.59942,4.53],[0.45335,0.54109,2.6],[0.55877,0.62333,3.17],[0.75708,0.79218,3.84],[0.42644,0.60399,3.32],[0.49903,0.64309,2.05],[0.4837,0.79082,3.52],[0.44047,0.77275,3.76],[0.35994,0.85213,4.88],[0.33483,0.8836,3.92],[0.24558,0.68799,5.64],[0.08,0.60286,4.43],[0.09817,0.38748,4.37],[0.12599,0.19984,4.12],[0.32107,0.23549,3.96],[0.32522,0.1164,4.27]]},
"Cap":{"paths":[[[0.92,0.78659],[0.89209,0.69741]],[[0.89209,0.69741],[0.46791,0.59965]],[[0.46791,0.59965],[0.31405,0.61554]],[[0.31405,0.61554],[0.14561,0.62241]],[[0.14561,0.62241],[0.08,0.64374]],[[0.31405,0.61554],[0.27232,0.39316]],[[0.27232,0.39316],[0.46791,0.59965]],[[0.89209,0.69741],[0.6553,0.27913]],[[0.46791,0.59965],[0.60125,0.21341]]],"stars":[[0.92,0.78659,3.58],[0.89209,0.69741,3.05],[0.46791,0.59965,4.08],[0.31405,0.61554,4.28],[0.14561,0.62241,3.69],[0.08,0.64374,2.85],[0.27232,0.39316,3.77],[0.6553,0.27913,4.13],[0.60125,0.21341,4.12]]},
"Aqr":{"paths":[[[0.68263,0.61011],[0.49751,0.72518]],[[0.49751,0.72518],[0.41165,0.70179]],[[0.41165,0.70179],[0.37284,0.73175]],[[0.37284,0.73175],[0.33755,0.72961]],[[0.33755,0.72961],[0.2442,0.5661]],[[0.2442,0.5661],[0.11829,0.53306]],[[0.11829,0.53306],[0.08,0.29173]],[[0.49751,0.72518],[0.43774,0.56164]],[[0.43774,0.56164],[0.49397,0.42827]],[[0.43774,0.56164],[0.36302,0.49821]],[[0.36302,0.49821],[0.26055,0.43434]],[[0.26055,0.43434],[0.23319,0.38552]],[[0.23319,0.38552],[0.15315,0.26825]],[[0.92,0.52411],[0.68263,0.61011]]],"stars":[[0.68263,0.61011,2.9],[0.49751,0.72518,2.95],[0.41165,0.70179,3.86],[0.37284,0.73175,3.65],[0.33755,0.72961,4.04],[0.2442,0.5661,3.73],[0.11829,0.53306,4.24],[0.08,0.29173,3.96],[0.43774,0.56164,4.17],[0.49397,0.42827,4.29],[0.36302,0.49821,4.82],[0.26055,0.43434,4.05],[0.23319,0.38552,3.27],[0.15315,0.26825,3.68],[0.92,0.52411,3.78]]},
"Psc":{"paths":[[[0.38174,0.81576],[0.32606,0.66649]],[[0.38174,0.81576],[0.29693,0.72191]],[[0.29693,0.72191],[0.32606,0.66649]],[[0.32606,0.66649],[0.23571,0.47552]],[[0.23571,0.47552],[0.16484,0.34759]],[[0.16484,0.34759],[0.08,0.21541]],[[0.08,0.21541],[0.12326,0.22417]],[[0.12326,0.22417],[0.18503,0.27172]],[[0.18503,0.27172],[0.24232,0.28529]],[[0.24232,0.28529],[0.38111,0.32139]],[[0.38111,0.32139],[0.45576,0.30919]],[[0.45576,0.30919],[0.59684,0.3276]],[[0.59684,0.3276],[0.70528,0.30016]],[[0.70528,0.30016],[0.80392,0.27459]],[[0.80392,0.27459],[0.79324,0.19508]],[[0.79324,0.19508],[0.87024,0.18424]],[[0.87024,0.18424],[0.92,0.22613]],[[0.92,0.22613],[0.86496,0.29015]],[[0.86496,0.29015],[0.80392,0.27459]]],"stars":[[0.38174,0.81576,5.5],[0.32606,0.66649,4.67],[0.29693,0.72191,4.74],[0.23571,0.47552,3.62],[0.16484,0.34759,4.26],[0.08,0.21541,3.82],[0.12326,0.22417,4.61],[0.18503,0.27172,4.45],[0.24232,0.28529,4.84],[0.38111,0.32139,4.27],[0.45576,0.30919,5.92],[0.59684,0.3276,5.38],[0.70528,0.30016,4.03],[0.80392,0.27459,4.13],[0.79324,0.19508,4.49],[0.87024,0.18424,4.95],[0.92,0.22613,3.7],[0.86496,0.29015,4.27]]}};

function num(o, k, d) {
  const v = o && o[k];
  return v === undefined || v === null || Number.isNaN(Number(v)) ? d : Number(v);
}
function path(points, close, color, width, opacity, dash) {
  ink.poly(points, !!close);
  ink.stroke(color, width, opacity, !!close, dash);
}
function ellipse(x, y, rx, ry, angle, color, width, opacity, dash) {
  ink.push(); ink.translate(x, y); ink.rotate(angle); ink.scale(rx, ry);
  ink.circle(0, 0, 1); ink.stroke(color, width / Math.max(rx, ry), opacity, false, dash); ink.pop();
}
function arc(x, y, rx, ry, angle, a0, a1, color, width, opacity, dash) {
  const pts = [], n = Math.max(12, Math.ceil(Math.abs(a1 - a0) / 5)), ar = angle * rad;
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * rad, px = rx * cos(a), py = ry * sin(a);
    pts.push([x + px * cos(ar) - py * sin(ar), y + px * sin(ar) + py * cos(ar)]);
  }
  path(pts, false, color, width, opacity, dash);
}
function star(x, y, r, cross, accent, opacity) {
  const c = accent ? ink.accent(0) : tone(0.01);
  if (!cross) { ink.circle(x, y, r * 1.08); ink.fill(c, Math.max(0.62, opacity)); return; }
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = pi / 2 + i * pi / 8;
    const rr = i % 2 ? r * 0.42 : (i % 4 === 0 ? r * 3.0 : r * 1.65);
    pts.push([x + rr * cos(a), y + rr * sin(a)]);
  }
  ink.poly(pts, true); ink.fill(c, Math.max(0.78, opacity));
  ink.circle(x, y, r * 0.30); ink.fill(accent ? tone(0.01) : ink.accent(0), 0.92);
}
function plan(seed, options) {
  const o = options && typeof options === "object" ? options : {};
  const rng = ink.rng(seed * 7919 + 12);
  const zodiac = ZODIAC_ORDER[(seed - 1) % ZODIAC_ORDER.length];
  const out = { special: null, constellation: zodiac, comet: false };
  const roll = rng.u();
  const squidP = Math.max(0, num(o, "squid", 0.045));
  const shipP = Math.max(0, num(o, "ships", 0.14));
  const planetP = Math.max(0, num(o, "planets", 0.46));
  const kind = roll < squidP ? "squid" : roll < squidP + shipP ? "ship" : roll < squidP + shipP + planetP ? "planet" : null;
  if (kind) out.special = { kind, size: rng.range(0.90, 1.14), angle: rng.range(-22, 18) };
  else out.comet = rng.chance(0.55);
  return out;
}
function constellationGeometry(zodiac, W, H, box) {
  const data = typeof zodiac === "string" ? ZODIAC[zodiac] : zodiac;
  const b = box || [0.065, 0.765, 0.37, 0.17];
  const map = (p) => [(b[0] + p[0] * b[2]) * W, (b[1] + p[1] * b[3]) * H];
  const paths = data.paths.map((line) => line.map(map));
  const stars = data.stars.map((p) => ({ p: map(p), mag: p[2] }));
  // Корень роста — нижняя, при равенстве самая левая звезда фигуры.
  let root = stars[0].p;
  for (const s of stars) if (s.p[1] < root[1] - 1e-6 || (Math.abs(s.p[1] - root[1]) < 1e-6 && s.p[0] < root[0])) root = s.p;
  return { paths, stars, root };
}
function constellation(zodiac, W, H, faint, box) {
  const g = constellationGeometry(zodiac, W, H, box), op = faint ? 0.52 : 0.90;
  for (const pp of g.paths) path(pp, false, tone(0.08), 0.42, op);
  for (let i = 0; i < g.stars.length; i++) {
    const s = g.stars[i], r = Math.max(0.026, 0.064 - s.mag * 0.0065);
    star(s.p[0], s.p[1], r, s.mag < 3.15 || i % 5 === 0, i === 0, op + 0.08);
  }
}
function hatchCircle(x, y, r, angle, spacing, color, width, opacity, cross) {
  const ar = angle * rad, dx = cos(ar), dy = sin(ar), nx = -dy, ny = dx;
  for (let off = -r * 0.94; off <= r * 0.94; off += spacing) {
    const half = Math.sqrt(Math.max(0, r * r - off * off)) * 0.97;
    const mx = x + nx * off, my = y + ny * off;
    ink.moveto(mx - dx * half, my - dy * half); ink.lineto(mx + dx * half, my + dy * half);
    ink.stroke(color, width, opacity);
  }
  if (cross) {
    const ar2 = (angle + 63) * rad, ux = cos(ar2), uy = sin(ar2), vx = -uy, vy = ux;
    for (let off = -r * 0.86; off <= r * 0.86; off += spacing * 1.45) {
      const half = Math.sqrt(Math.max(0, r * r - off * off)) * 0.92;
      const mx = x + vx * off, my = y + vy * off;
      ink.moveto(mx - ux * half, my - uy * half); ink.lineto(mx + ux * half, my + uy * half);
      ink.stroke(color, width * 0.75, opacity * 0.55);
    }
  }
}
function ringBand(x, y, rx, ry, angle, band, color, opacity) {
  const outer = [], inner = [], n = 128, ar = angle * rad;
  for (let i = 0; i < n; i++) {
    const a = 2 * pi * i / n;
    for (const [arr, sx, sy] of [[outer, rx, ry], [inner, Math.max(0.01, rx - band), Math.max(0.01, ry - band)]]) {
      const px = sx * cos(a), py = sy * sin(a);
      arr.push([x + px * cos(ar) - py * sin(ar), y + px * sin(ar) + py * cos(ar)]);
    }
  }
  ink.poly(outer.concat(inner.reverse()), true); ink.fill(color, opacity);
  // Короткие поперечные штрихи делают кольцо гравированной лентой, а не плоской заливкой.
  for (let i = 0; i < 96; i++) {
    const q = 2 * pi * i / 96, px = rx * cos(q), py = ry * sin(q);
    const ix = (rx - band * 0.82) * cos(q), iy = (ry - band * 0.82) * sin(q);
    const ox = (rx - band * 0.16) * cos(q), oy = (ry - band * 0.16) * sin(q);
    ink.moveto(x + ix * cos(ar) - iy * sin(ar), y + ix * sin(ar) + iy * cos(ar));
    ink.lineto(x + ox * cos(ar) - oy * sin(ar), y + ox * sin(ar) + oy * cos(ar));
    ink.stroke(tone(0.01), 0.28, 0.52);
  }
  path(outer, true, tone(0.01), 0.72, 0.94);
  path(inner, true, tone(0.04), 0.48, 0.88);
  arc(x, y, rx - band * 0.50, ry - band * 0.50, angle, 0, 360, tone(0.08), 0.28, 0.62);
}
function radiantSun(x, y, r) {
  occultCircle(x, y, r * 1.015);
  for (let i = 0; i < 32; i++) {
    const a = 2 * pi * i / 32, inner = r * (i % 2 ? 1.25 : 1.12), outer = r * (i % 2 ? 1.85 : 2.35);
    ink.moveto(x + inner * cos(a), y + inner * sin(a)); ink.lineto(x + outer * cos(a), y + outer * sin(a));
    ink.stroke(i % 4 === 0 ? ink.accent(0) : tone(0.03), i % 4 === 0 ? 0.58 : 0.38, 0.88);
  }
  ink.circle(x, y, r); ink.fill(ink.accent(0.12), 0.42); ink.circle(x, y, r); ink.stroke(tone(0.01), 0.85, 0.95);
  ink.circle(x, y, r * 0.72); ink.stroke(ink.accent(0), 0.42, 0.90);
  star(x, y, r * 0.18, true, false, 0.95);
}
function armillary(cx, cy, R, seed) {
  const rng = ink.rng(seed * 7919 + 771);
  ink.layer(2);
  // Тонкая радиальная сетка остаётся за массивными кольцами и глобусом.
  for (let i = 0; i < 16; i++) {
    const a = 2 * pi * i / 16;
    ink.moveto(cx, cy); ink.lineto(cx + R * cos(a), cy + R * sin(a));
    ink.stroke(tone(0.12), 0.34, 0.56);
  }
  ink.circle(cx, cy, R); ink.stroke(tone(0.01), 1.15, 0.96);
  ink.circle(cx, cy, R * 0.94); ink.stroke(tone(0.05), 0.48, 0.88);
  for (let i = 0; i < 72; i++) {
    const a = 2 * pi * i / 72, r0 = R * (i % 6 === 0 ? 0.89 : 0.915), r1 = R * 0.945;
    ink.moveto(cx + r0 * cos(a), cy + r0 * sin(a)); ink.lineto(cx + r1 * cos(a), cy + r1 * sin(a));
    ink.stroke(tone(0.02), i % 6 === 0 ? 0.55 : 0.34, 0.88);
  }
  ringBand(cx, cy, R * 0.93, R * 0.29, -13, R * 0.052, tone(0.30), 0.62);
  ringBand(cx, cy, R * 0.34, R * 0.93, 29, R * 0.045, tone(0.40), 0.56);
  ringBand(cx, cy, R * 0.79, R * 0.23, 53, R * 0.040, ink.accent(0.15), 0.38);
  // Центральная планета: тёмный контур и два направления штриха.
  const gr = R * rng.range(0.31, 0.36);
  ink.circle(cx, cy, gr); ink.fill(tone(0.56), 0.56);
  hatchCircle(cx, cy, gr, -28, gr * 0.075, tone(0.01), 0.38, 0.78, true);
  ink.circle(cx, cy, gr); ink.stroke(tone(0), 1.05, 0.98);
  arc(cx, cy, gr * 0.98, gr * 0.26, 0, 0, 360, tone(0.02), 0.50, 0.90);
  arc(cx, cy, gr * 0.36, gr * 0.98, -16, 65, 295, tone(0.04), 0.45, 0.85);
  // Передние дуги восстанавливают порядок «задние кольца → глобус → передние кольца».
  arc(cx, cy, R * 0.93, R * 0.29, -13, 184, 356, tone(0), 1.10, 0.98);
  arc(cx, cy, R * 0.88, R * 0.24, -13, 187, 353, ink.accent(0), 0.48, 0.92);
  arc(cx, cy, R * 0.34, R * 0.93, 29, 184, 350, tone(0.01), 0.90, 0.95);
  for (let i = 0; i < 7; i++) {
    const a = (18 + i * 47) * rad;
    star(cx + R * 0.93 * cos(a), cy + R * 0.93 * sin(a), 0.045, i % 2 === 0, i === 3, 0.94);
  }
}
// Эксперимент V4: изогнутый штрих и второй слой только в глубокой тени.
// Все размеры масштабируются от эталонного шара r=15.5 из отдельной пробы.
const HATCH_LIGHT = [-0.50, 0.62, 0.70];
const HATCH_LL = Math.sqrt(HATCH_LIGHT[0] ** 2 + HATCH_LIGHT[1] ** 2 + HATCH_LIGHT[2] ** 2);
HATCH_LIGHT[0] /= HATCH_LL; HATCH_LIGHT[1] /= HATCH_LL; HATCH_LIGHT[2] /= HATCH_LL;
function hatchClamp(v, a, b) { return Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v)); }
function engravingDarkness(cx, cy, r, x, y) {
  const nx = (x - cx) / r, ny = (y - cy) / r;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const dot = nx * HATCH_LIGHT[0] + ny * HATCH_LIGHT[1] + nz * HATCH_LIGHT[2];
  return hatchClamp(1 - Math.max(0, dot));
}
function engravingSegment(x1, y1, x2, y2, dark, threshold, maxW, minW, taper, opacity) {
  const w = maxW * hatchClamp((dark - threshold) / (1 - threshold)) * taper;
  if (w < minW) return;
  ink.moveto(x1, y1); ink.lineto(x2, y2); ink.stroke(tone(0.01), w, opacity);
}
function straightEngravingV4(cx, cy, r, threshold, maxW, minW, opacity, angle, spacingK) {
  const a = angle * rad, ux = cos(a), uy = sin(a), vx = -uy, vy = ux, spacing = r * spacingK;
  for (let off = -r * 0.97; off <= r * 0.97; off += spacing) {
    const mx = cx + vx * off, my = cy + vy * off;
    const half = Math.sqrt(Math.max(0, r * r - off * off)) * 0.985, n = 36;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
      const x1 = mx + ux * half * (2 * t0 - 1), y1 = my + uy * half * (2 * t0 - 1);
      const x2 = mx + ux * half * (2 * t1 - 1), y2 = my + uy * half * (2 * t1 - 1);
      const endDistance = Math.min(tm, 1 - tm) * 2 * half;
      const taper = hatchClamp(endDistance / (r * 0.13));
      engravingSegment(x1, y1, x2, y2, engravingDarkness(cx, cy, r, (x1 + x2) / 2, (y1 + y2) / 2), threshold, maxW, minW, taper, opacity);
    }
  }
}
function curvedEngravingV4(cx, cy, r, op) {
  // Толщина не уходит в микроскопические значения на малых планетах орнамента.
  const mainW = Math.max(0.30, 1.85 * r / 15.5), lx = cx - 0.50 * r, ly = cy + 0.60 * r, spacing = r * 0.085;
  for (let rr = 0.16 * r; rr <= 2.28 * r; rr += spacing) {
    const samples = 144;
    let run = [];
    const flushRun = () => {
      if (run.length >= 2) {
        for (let i = 0; i < run.length - 1; i++) {
          const p = run[i], q = run[i + 1], x = (p[0] + q[0]) / 2, y = (p[1] + q[1]) / 2;
          const taper = hatchClamp(Math.min(i + 1, run.length - 1 - i) / 4);
          engravingSegment(p[0], p[1], q[0], q[1], engravingDarkness(cx, cy, r, x, y), 0.08, mainW, 0.045, taper, 0.95 * op);
        }
      }
      run = [];
    };
    for (let i = 0; i <= samples; i++) {
      const a = 2 * pi * i / samples, x = lx + rr * cos(a), y = ly + rr * sin(a), dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r * 0.998) run.push([x, y]); else flushRun();
    }
    flushRun();
  }
  straightEngravingV4(cx, cy, r, 0.60, Math.max(0.26, 1.05 * r / 15.5), 0.045, 0.82 * op, 42, 0.115);
}
function engravedLimbV4(cx, cy, r, op) {
  arc(cx, cy, r, r, 0, 225, 402, tone(0.01), Math.max(0.62, 0.92 * r / 15.5), 0.95 * op);
  for (const a of [[48, 91], [104, 151], [165, 211]])
    arc(cx, cy, r, r, 0, a[0], a[1], tone(0.01), Math.max(0.20, 0.24 * r / 15.5), 0.42 * op);
}
function planet(x, y, r, angle, ringed, quiet) {
  const op = quiet ? 0.72 : 1;
  if (ringed) ringBand(x, y, r * 1.82, r * 0.45, angle - 14, r * 0.12, ink.accent(0.08), 0.48 * op);
  occultCircle(x, y, r * 1.012);
  curvedEngravingV4(x, y, r, op);
  engravedLimbV4(x, y, r, op);
  if (ringed) {
    arc(x, y, r * 1.82, r * 0.45, angle - 14, 188, 352, tone(0), 0.90, 0.98 * op);
    arc(x, y, r * 1.67, r * 0.34, angle - 14, 188, 352, ink.accent(0), 0.50, 0.92 * op);
  }
  star(x + r * 1.55, y + r * 1.35, r * 0.040, true, false, 0.95);
}
function moon(x, y, r, angle, withOrbit) {
  ink.push(); ink.translate(x, y); ink.rotate(angle);
  const shape = () => {
    const pts = [];
    for (let i = 0; i <= 32; i++) { const a = (62 + 236 * i / 32) * rad; pts.push([r * cos(a), r * sin(a)]); }
    ink.poly(pts, false); ink.curveto(-0.12 * r, -0.58 * r, -0.12 * r, 0.58 * r, pts[0][0], pts[0][1]); ink.close();
  };
  shape(); ink.fill(PAPER, 1);
  shape(); ink.fill(tone(0.48), 0.62); ink.stroke(tone(0), 0.85, 0.96); ink.pop();
  if (withOrbit !== false) ellipse(x, y, r * 1.55, r * 0.55, angle + 24, tone(0.40), 0.30, 0.45, "[1.2 2] 0");
}
function comet(x, y, s, angle) {
  const oldLayer = ink.layer(4);
  ink.push(); ink.translate(x, y); ink.rotate(angle);
  const cubic = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };
  for (let strand = 0; strand < 5; strand++) {
    const off = strand - 2;
    for (let seg = 0; seg < 20; seg++) {
      const t0 = seg / 20, t1 = (seg + 1) / 20;
      const point = (t) => [
        s * cubic(-0.12, -0.85, -2.00, -3.45, t),
        s * (off * 0.065 + cubic(0, off * 0.10, off * 0.22, off * 0.34, t) + 0.06 * sin(pi * t))
      ];
      const a = point(t0), b = point(t1), fade = Math.pow(1 - t0, 0.82);
      ink.moveto(a[0], a[1]); ink.lineto(b[0], b[1]);
      ink.stroke(strand === 2 ? ink.accent(0.08) : tone(0.20 + 0.025 * Math.abs(off)),
        Math.max(0.10, (0.34 - 0.025 * Math.abs(off)) * fade),
        (strand === 2 ? 0.62 : 0.48) * fade);
    }
  }
  ink.layer(6);
  occultCircle(0, 0, 0.245 * s);
  ink.circle(0, 0, 0.24 * s); ink.fill(tone(0.35), 0.78);
  hatchCircle(0, 0, 0.24 * s, -30, 0.035 * s, tone(0), 0.34, 0.82, false);
  ink.circle(0, 0, 0.24 * s); ink.stroke(tone(0), 0.80, 0.98);
  star(0.04 * s, 0.04 * s, 0.055 * s, true, true, 0.85);
  ink.pop(); ink.layer(oldLayer);
}
function ship(x, y, k, angle) {
  const oldLayer = ink.layer(2);
  ink.push(); ink.translate(x, y); ink.rotate(angle); ink.scale(k);
  for (let i = 0; i < 3; i++) {
    ink.moveto(-0.72, (i - 1) * 0.11); ink.lineto(-1.75 - i * 0.25, (i - 1) * 0.17);
    ink.stroke(ink.accent(0.08), 0.38, 0.64 - i * 0.1, false, "[1.2 1.6] 0");
  }
  ink.layer(6);
  const hull = [[-0.72, 0], [-0.28, 0.18], [0.34, 0.13], [0.76, 0], [0.30, -0.13], [-0.30, -0.16]];
  const finTop = [[-0.22, 0.13], [-0.52, 0.48], [0.18, 0.15]];
  const finBottom = [[-0.20, -0.12], [-0.44, -0.40], [0.20, -0.14]];
  occultPoly(hull); occultPoly(finTop); occultPoly(finBottom);
  ink.poly(hull, true); ink.fill(tone(0.26), 0.88); ink.stroke(tone(0), 0.85, 0.98);
  ink.poly(finTop, true); ink.fill(tone(0.42), 0.78); ink.stroke(tone(0.02), 0.55, 0.95);
  ink.poly(finBottom, true); ink.fill(tone(0.42), 0.78); ink.stroke(tone(0.02), 0.55, 0.95);
  ink.circle(0.18, 0, 0.09); ink.fill(ink.accent(0), 0.82);
  ink.moveto(-0.48, 0); ink.lineto(0.48, 0); ink.stroke(ink.accent(0.05), 0.42, 0.92);
  for (let i = 0; i < 5; i++) { ink.moveto(-0.43 + i * 0.13, 0.15); ink.lineto(-0.30 + i * 0.10, 0.31); ink.stroke(tone(0.01), 0.30, 0.80); }
  ink.pop(); ink.layer(oldLayer);
}
function squid(x, y, k, angle) {
  ink.push(); ink.translate(x, y); ink.rotate(angle * 0.35); ink.scale(k);
  // Длинные несимметричные щупальца: существо, а не декоративная ветвь.
  for (let i = 0; i < 8; i++) {
    const dx = (i - 3.5) * 0.15, bend = (i % 2 ? 1 : -1) * (0.22 + 0.035 * i);
    ink.moveto(dx * 0.62, -0.20);
    ink.curveto(dx + bend, -0.52, dx - bend, -0.91, dx + bend * 0.85, -1.25 + 0.055 * Math.abs(i - 3.5));
    ink.stroke(tone(0), 0.78, 0.96);
    ink.circle(dx + bend * 0.85, -1.25 + 0.055 * Math.abs(i - 3.5), 0.026); ink.fill(ink.accent(0.06), 0.78);
  }
  ink.push(); ink.scale(0.74, 1); occultCircle(0, 0.10, 0.505); ink.circle(0, 0.10, 0.50); ink.fill(tone(0.38), 0.80); hatchCircle(0, 0.10, 0.50, -32, 0.065, tone(0), 0.34, 0.82, true); ink.circle(0, 0.10, 0.50); ink.stroke(tone(0), 0.85, 0.98); ink.pop();
  const head = [[-0.34, 0.34], [0, 0.93], [0.34, 0.34]];
  occultPoly(head); ink.poly(head, true); ink.fill(tone(0.38), 0.80); ink.stroke(tone(0), 0.85, 0.98);
  // Раскосые медные глаза и тёмные зрачки.
  ink.poly([[-0.29, 0.29], [-0.06, 0.19], [-0.10, 0.29]], true); ink.fill(ink.accent(0), 0.96);
  ink.poly([[0.29, 0.29], [0.06, 0.19], [0.10, 0.29]], true); ink.fill(ink.accent(0), 0.96);
  ink.circle(-0.14, 0.245, 0.025); ink.circle(0.14, 0.245, 0.025); ink.fill(tone(0), 1);
  ink.pop();
}
function special(p, W, H, quiet, pos, angle) {
  const x = pos[0], y = pos[1], m = Math.min(W, H);
  if (!p) { moon(x, y, m * 0.045, angle - 18); return; }
  if (p.kind === "planet") planet(x, y, m * 0.100 * p.size, angle - 14, true, quiet);
  else if (p.kind === "ship") ship(x, y, m * 0.098 * p.size, angle);
  else squid(x, y, m * 0.108 * p.size, angle);
}
function cubic(g, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * g[0][0] + b * g[1][0] + c * g[2][0] + d * g[3][0],
    a * g[0][1] + b * g[1][1] + c * g[2][1] + d * g[3][1]];
}
function cubicTangent(g, t) {
  const u = 1 - t;
  return [3 * u * u * (g[1][0] - g[0][0]) + 6 * u * t * (g[2][0] - g[1][0]) + 3 * t * t * (g[3][0] - g[2][0]),
    3 * u * u * (g[1][1] - g[0][1]) + 6 * u * t * (g[2][1] - g[1][1]) + 3 * t * t * (g[3][1] - g[2][1])];
}
function composition(W, H, zodiac) {
  const cg = constellationGeometry(zodiac, W, H);
  return {
    cg,
    left: [[W * 0.30, H * 0.48], [W * 0.04, H * 0.55], [W * 0.04, H * 0.72], cg.root],
    right: [[W * 0.66, H * 0.46], [W * 0.93, H * 0.51], [W * 0.94, H * 0.73], [W * 0.87, H * 0.875]]
  };
}
function guideStroke(g, color, width, opacity) {
  ink.moveto(g[0][0], g[0][1]);
  ink.curveto(g[1][0], g[1][1], g[2][0], g[2][1], g[3][0], g[3][1]);
  ink.stroke(color, width, opacity);
}
function drawGuides(guides) {
  for (const g of [guides.left, guides.right]) {
    guideStroke(g, tone(0.08), 0.56, 0.88);
    // Тонкая спутниковая нить повторяет главную траекторию.
    const echo = g.map((p, i) => [p[0] + (i < 2 ? -0.10 : 0.10), p[1] + 0.035]);
    guideStroke(echo, ink.accent(0.10), 0.28, 0.62);
    for (const t of [0.36, 0.54, 0.72, 0.88]) {
      const q = cubic(g, t);
      star(q[0], q[1], t === 0.72 ? 0.042 : 0.028, t === 0.72, t === 0.54, 0.90);
    }
  }
}
function titleZone(x, y, W, H) { return x > 0.38 * W && x < 0.82 * W && y > 0.59 * H && y < 0.80 * H; }
function orbitalDust(seed, W, H, count, guides) {
  const rng = ink.rng(seed * 7919 + 12011), cx = W * 0.45, cy = H * 0.30, R = W * 0.405;
  for (let i = 0; i < count; i++) {
    let x, y;
    const mode = i % 10;
    if (mode < 5) {
      // Пыль прорастает вдоль тех же двух дуг, не заполняя лист равномерно.
      const g = mode < 3 ? guides.left : guides.right, t = rng.range(0.03, 0.98), q = cubic(g, t), v = cubicTangent(g, t);
      const len = Math.max(0.0001, Math.sqrt(v[0] * v[0] + v[1] * v[1])), off = rng.sym(0.12);
      x = q[0] - v[1] / len * off; y = q[1] + v[0] / len * off;
    } else if (mode < 9) {
      // Второй слой пыли принадлежит кольцам армиллярной сферы.
      const a = rng.range(0, 2 * pi), which = i % 3;
      let rx = R * 0.98, ry = R * 0.98, ar = 0;
      if (which === 1) { rx = R * 0.93; ry = R * 0.29; ar = -13 * rad; }
      if (which === 2) { rx = R * 0.34; ry = R * 0.93; ar = 29 * rad; }
      const px = rx * cos(a), py = ry * sin(a), off = rng.sym(0.075);
      x = cx + px * cos(ar) - py * sin(ar) + off; y = cy + px * sin(ar) + py * cos(ar) + off;
    } else {
      // Редкие дальние звёзды только у краёв: фон подчинён композиции.
      x = (rng.chance(0.5) ? rng.range(0.025, 0.12) : rng.range(0.88, 0.975)) * W;
      y = rng.range(0.08, 0.95) * H;
    }
    if (titleZone(x, y, W, H)) continue;
    const bright = rng.chance(0.20), r = rng.range(0.014, bright ? 0.048 : 0.028);
    star(x, y, r, bright && rng.chance(0.50), rng.chance(0.10), rng.range(0.60, 0.96));
  }
}
function starfield(seed, W, H, count, avoidTitle, quiet, clearCenter) {
  const rng = ink.rng(seed * 7919 + 12011);
  for (let i = 0; i < count; i++) {
    const edge = clearCenter ? 0.09 : 0.035;
    const x = rng.range(edge, 1 - edge) * W, y = rng.range(edge, 1 - edge) * H;
    if (avoidTitle && titleZone(x, y, W, H) && rng.chance(0.90)) continue;
    if (clearCenter && Math.abs(x - W / 2) < W * 0.27 && Math.abs(y - H / 2) < H * 0.27) continue;
    const bright = rng.chance(0.22), r = rng.range(0.016, bright ? 0.055 : 0.032);
    star(x, y, r, bright && rng.chance(0.55), rng.chance(0.12), rng.range(quiet ? 0.45 : 0.66, quiet ? 0.70 : 0.98));
  }
}
function page(o) {
  o = o || {};
  const P = require("../src/page.js");
  let paper = o.paper || ["120mm", "200mm"];
  if (typeof paper === "string") {
    const m = /^(\d+\.?\d*)x(\d+\.?\d*)$/.exec(paper);
    if (!m) throw new Error("cosmos: unknown paper '" + paper + "'");
    paper = [m[1] + "mm", m[2] + "mm"];
  }
  const W = P.sp(paper[0]) / P.sp("1cm"), H = P.sp(paper[1]) / P.sp("1cm");
  const seed = Math.floor(Number(o.seed));
  if (!(seed >= 1)) throw new Error("cosmos: a seed is a positive integer");
  const p = plan(seed, o);
  const svg = require("../src/ornaments.js").sheet(W, H, o.id || ("eng" + seed + "-"), () => {
    const guides = composition(W, H, p.constellation);
    ink.layer(1); orbitalDust(seed, W, H, Math.round(num(o, "stars", 148)), guides);
    ink.layer(2);
    drawGuides(guides);
    armillary(W * 0.45, H * 0.30, W * 0.405, seed);
    ink.layer(3);
    constellation(p.constellation, W, H, false);
    radiantSun(W * 0.87, H * 0.875, Math.min(W, H) * 0.026);
    // Нижняя шкала — как градусная рамка старой небесной карты.
    path([[W * 0.13, H * 0.055], [W * 0.87, H * 0.055]], false, tone(0.01), 0.62, 0.94);
    for (let i = 0; i <= 36; i++) {
      const x = W * (0.13 + 0.74 * i / 36), hh = H * (i % 6 === 0 ? 0.008 : i % 3 === 0 ? 0.0055 : 0.0035);
      path([[x, H * 0.055 - hh], [x, H * 0.055 + hh]], false, tone(0.01), i % 6 === 0 ? 0.48 : 0.32, 0.90);
    }
    ink.layer(4);
    const rp = cubic(guides.right, p.comet ? 0.29 : 0.20), rv = cubicTangent(guides.right, p.comet ? 0.29 : 0.20);
    const ra = D.atan2(rv[1], rv[0]) / rad;
    if (p.special) special(p.special, W, H, false, rp, ra);
    else if (p.comet) comet(rp[0], rp[1], Math.min(W, H) * 0.105, ra);
    else special(null, W, H, false, rp, ra);
    const lp = cubic(guides.left, 0.20), lv = cubicTangent(guides.left, 0.20);
    moon(lp[0], lp[1], Math.min(W, H) * 0.050, D.atan2(lv[1], lv[0]) / rad - 35);
  }, o);
  return { svg, g: { pw: W, ph: H }, stats: { theme: "cosmos-engraving", zodiac: p.constellation, motifs: 148 + (p.special ? 1 : 0) + ZODIAC[p.constellation].stars.length } };
}
function band(o) {
  o = o || {}; const W = (o.width || 128) / 10, H = (o.height || 80) / 10, seed = Math.floor(Number(o.seed));
  const rng = ink.rng(seed * 7919 + 15013);
  return require("../src/ornaments.js").sheet(W, H, o.id || ("cos" + seed + "b-"), () => {
    ink.layer(1); starfield(seed + 31, W, H, 42, false, false);
    ink.layer(2);
    ellipse(W * 0.48, H * 0.42, W * 0.48, H * 0.36, -5, tone(0.08), 0.52, 0.76);
    ellipse(W * 0.48, H * 0.42, W * 0.37, H * 0.25, -5, tone(0.16), 0.38, 0.68, "[1.2 2] 0");
    arc(W * 0.48, H * 0.42, W * 0.52, H * 0.42, -5, 182, 344, ink.accent(0.08), 0.45, 0.58);
    constellation(ZODIAC_ORDER[seed % 12], W, H, true, [0.05, 0.58, 0.34, 0.34]);
    ink.layer(3);
    planet(W * 0.80, H * 0.46, Math.min(W, H) * 0.16, -8, true, false);
    star(W * 0.48, H * 0.42, 0.075, true, true, 0.85);
    if (rng.chance(0.12)) ship(W * 0.60, H * 0.72, Math.min(W, H) * 0.12, 8);
    else comet(W * 0.61, H * 0.70, Math.min(W, H) * 0.11, 12);
  }, o);
}
function tailgarden(o) {
  o = Object.assign({ intensity: 0.35 }, o || {});
  const W = (o.width || 114) / 10, H = (o.height || 60) / 10, seed = Math.floor(Number(o.seed));
  return require("../src/ornaments.js").sheet(W, H, o.id || ("cos" + seed + "t-"), () => {
    ink.layer(1); starfield(seed + 67, W, H, 22, false, true);
    ink.layer(2);
    arc(W * 0.47, H * 0.35, W * 0.43, H * 0.42, 4, 5, 176, tone(0.32), 0.40, 0.60);
    arc(W * 0.47, H * 0.35, W * 0.32, H * 0.28, 4, 184, 354, tone(0.38), 0.32, 0.55, "[1.2 2] 0");
    constellation(ZODIAC_ORDER[seed % 12], W, H, true, [0.06, 0.32, 0.36, 0.42]);
    planet(W * 0.78, H * 0.43, Math.min(W, H) * 0.13, 0, false, true);
    star(W * 0.48, H * 0.35, 0.055, true, true, 0.60);
  }, o);
}
function vignette(o) {
  o = Object.assign({ intensity: 0.35 }, o || {});
  const W = 7, H = 2.6, seed = Math.floor(Number(o.seed));
  return require("../src/ornaments.js").sheet(W, H, o.id || ("cos" + seed + "v-"), () => {
    ink.layer(1);
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 28; i++) {
        const t = i / 28; pts.push([W / 2 + side * (0.28 + 2.75 * t), 1.12 + 0.28 * sin(t * pi * 1.4) - 0.15 * t]);
      }
      path(pts, false, tone(0.30), 0.34, 0.64);
      for (const i of [7, 15, 23]) star(pts[i][0], pts[i][1], 0.035, i === 15, false, 0.68);
      planet(W / 2 + side * 3.03, 0.97, 0.16, side * 12, false, true);
    }
    ellipse(W / 2, 1.15, 0.68, 0.30, -12, ink.accent(0.08), 0.32, 0.60);
    star(W / 2, 1.15, 0.12, true, true, 0.88);
    star(W / 2, 2.12, 0.045, true, false, 0.62);
  }, o);
}
function tile(o) {
  o = o || {}; const S = 2, seed = Math.floor(Number(o.seed));
  return require("../src/ornaments.js").sheet(S, S, o.id || ("cos" + seed + "i-"), () => {
    const m = 0.05 * S;
    ink.layer(1);
    ink.poly([[m, m], [S - m, m], [S - m, S - m], [m, S - m]], true); ink.fill(tone(0.92), 0.25);
    ink.layer(2); starfield(seed + 101, S, S, 18, false, true, true);
    ellipse(S / 2, S / 2, S * 0.41, S * 0.24, -28, tone(0.28), 0.34, 0.62);
    ellipse(S / 2, S / 2, S * 0.27, S * 0.40, 24, tone(0.42), 0.28, 0.52, "[1 1.8] 0");
    constellation(ZODIAC_ORDER[seed % 12], S, S, true, [0.10, 0.70, 0.34, 0.22]);
    planet(S * 0.80, S * 0.78, S * 0.085, -10, true, true);
    ink.layer(7);
    ink.poly([[m, m], [S - m, m], [S - m, S - m], [m, S - m]], true); ink.stroke(tone(0.05), 1.0, 0.9);
    const n = m + 0.03 * S;
    ink.poly([[n, n], [S - n, n], [S - n, S - n], [n, S - n]], true); ink.stroke(tone(0.05), 0.32, 0.75);
  }, o);
}
module.exports = { page, band, tailgarden, vignette, tile, plan,
  primitives: { star, planet, moon, comet, ship, squid, radiantSun, path, arc, occultPoly, occultCircle, occultEllipse, ZODIAC, ZODIAC_ORDER } };
