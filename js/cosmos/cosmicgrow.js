
// cosmicgrow.js — исходный алгоритм роста florilegium с космическими мотивами.
// Ветви, свободные области, заполнение и порядок слоёв сохранены.
//
// Без анимации роста (события, расписание, кадры): странице книги она не нужна.
// Все обращения к генераторам при этом на своих местах — включая те, что в Lua
// стоят в аргументах анимационных вызовов и выполняются всегда (arrive(...)
// у бабочек и пчёл): иначе после первой бабочки разошёлся бы весь сад.
// Темы (geometric, math) и отметки из текста (\florilegiumbloom) не переносились.
"use strict";
const ink = require("../src/ink.js");
const flora = require("./cosmicflora.js");
const D_ = require("../src/detmath.js");

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
// (?? вместо or: summer = 0 у budding в Lua — это 0, а не «нет значения»)
const motifs = [
  { name: "flower", w: 3, smin: 0.75, smax: 1.3, max: 3, hard: true, layer: L_BLOOM, spring: 0.12, autumn: 0.45,
    r: (s) => 1.0 * s, off: (s) => 0, draw: (rng, s) => F.flower(rng, s) },
  { name: "lily", w: 2, smin: 0.8, smax: 1.25, max: 2, hard: true, layer: L_BLOOM, upright: 0.4, spring: 0.1, autumn: 0.4,
    r: (s) => 0.9 * s, off: (s) => 0.15 * s, draw: (rng, s) => F.lily(rng, s) },
  { name: "blossoms", w: 3, smin: 0.55, smax: 0.85, max: 5, layer: L_BLOOM, upright: 1.6, spring: 0.5, autumn: 0.5,
    r: (s) => s, off: (s) => 0.6 * s,
    draw: (rng, s) => {
      // Один мотив на одном свободном участке: никаких веерных «гроздей».
      ink.layer(L_AIRY); F.blossom(rng, s);
    } },
  { name: "cyme", w: 3, smin: 1.0, smax: 2.4, max: 6, layer: L_AIRY, upright: 1.8, spring: 1.3, autumn: 0.7,
    r: (s) => 0.45 * s, off: (s) => 0.5 * s, draw: (rng, s) => F.cyme(rng, s) },
  { name: "sprig", w: 2, smin: 1.2, smax: 2.8, max: 4, layer: L_AIRY, upright: 1.8, spring: 1.2,
    r: (s) => 0.42 * s, off: (s) => 0.5 * s, draw: (rng, s) => F.sprig(rng, s) },
  { name: "umbel", w: 1.5, smin: 0.8, smax: 1.5, max: 3, hard: true, layer: L_AIRY, upright: 1.8, spring: 0.8, autumn: 0.8,
    r: (s) => 0.75 * s, off: (s) => 0.6 * s, draw: (rng, s) => F.umbel(rng, s) },
  { name: "leaf", w: 2, smin: 0.9, smax: 2.0, max: 8, layer: L_LEAF, upright: 1.5, spring: 1.3, autumn: 1.2,
    // Радиус покрывает настоящий спиральный рукав, а не только его центр.
    r: (s) => 0.58 * s, off: (s) => 0.5 * s,
    draw: (rng, s) => { ink.scale(s); const w = rng.range(0.22, 0.3); const depth = rng.chance(0.6) ? rng.range(0.4, 0.8) : 0; F.leaf(rng, { w, depth }); } },
  { name: "bud", w: 1, smin: 0.45, smax: 0.75, max: 5, layer: L_BLOOM, upright: 1.6, spring: 3.5, autumn: 0.3,
    r: (s) => 0.45 * s, off: (s) => 0.5 * s, draw: (rng, s) => F.bud(rng, s) },
  { name: "bells", w: 0.7, smin: 0.6, smax: 0.95, max: 1, hard: true, layer: L_BLOOM, hang: true, spring: 0.5, autumn: 0.6,
    r: (s) => 0.62 * s, off: (s) => 0,
    draw: (rng, s) => {
      const oldLayer = ink.layer(L_AIRY);
      F.bell(rng, s);
      ink.layer(L_STEM);
      ink.moveto(0, 0); ink.curveto(0.15 * s, 0.25 * s, 0.4 * s, 0.25 * s, 0.5 * s, 0.1 * s); ink.stroke(tone(0.14), 0.28, 0.62, false, "[1.10 1.45] 0");
      ink.push(); ink.translate(0.5 * s, 0.1 * s); ink.layer(L_AIRY); F.bell(rng, 0.75 * s); ink.pop();
      ink.layer(oldLayer);
    } },
  { name: "tendril", w: 0.6, smin: 0.3, smax: 0.5, max: 4, layer: L_AIRY, spring: 2, autumn: 1.3,
    r: (s) => 1.0 * s, off: (s) => 1.0 * s, draw: (rng, s) => { ink.rotate(90); F.tendril(rng, s); } },
  { name: "budding", w: 3, smin: 0.55, smax: 0.9, max: 6, layer: L_BLOOM, upright: 1.2, spring: 1, summer: 0, autumn: 0,
    r: (s) => 0.9 * s, off: (s) => 0.6 * s,
    draw: (rng, s) => {
      // Либо маленькая планета, либо один плоский знак.
      if (rng.chance(0.42)) F.bud(rng, 0.95 * s);
      else { ink.layer(L_AIRY); F.cyme(rng, 0.88 * s); }
    } },
  { name: "seedhead", w: 2, smin: 0.45, smax: 0.75, max: 3, hard: true, layer: L_AIRY, upright: 0.6, spring: 0, summer: 0, autumn: 1,
    r: (s) => 1.05 * s, off: (s) => 0, draw: (rng, s) => F.seedhead(rng, s) },
  { name: "butterfly", w: 0.8, smin: 1.1, smax: 1.5, max: 2, hard: true, layer: L_ACCENT, fly: true,
    r: (s) => 0.5 * s, off: (s) => 0,
    // на странице p = nil -> o = nil (без взмаха)
    draw: (rng, s, p) => F.butterfly(rng, s, (p === undefined || p === null) ? undefined : { open: 0.3 + 0.7 * abs(cos(p * 5 * pi)) }) },
  { name: "bee", w: 0.8, smin: 0.7, smax: 0.85, max: 1, hard: true, layer: L_ACCENT, fly: true,
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
  flora.reset_page(g.seed);
  const layout = rng.fork();
  ink.set_transform(ink.page_transform(g.mirror ? g.pw : null));

  const vis = ink.rng(g.seed * 7919 + 101);
  // Чистая типографическая версия: без иллюстративных кораблей, комет и кальмаров.
  let visiting = {};
  if (D < 0.3) { visiting.snail = false; visiting.bird = false; }
  const age = g.age;
  const season = (sp, su, au) => {
    if (age === undefined || age === null) return su;
    if (age < 0.5) return lerp(sp, su, smoothstep(0.1, 0.5, age));
    return lerp(su, au, smoothstep(0.5, 0.9, age));
  };
  const spring = season(1, 0, 0), autumn = season(0, 0, 1);
  const sea = ink.rng(g.seed * 7919 + 211);
  const blooms = [], starCenters = [];

  const { rects, col, foot, spill, fx1 } = regions(g, layout);
  const fld = field(rects);
  const gx = fld.x, gy = fld.y, free = fld.free, each_near = fld.each_near, disc = fld.disc, free_at = fld.free_at;
  const sdist = new Array(gx.length).fill(HUGE);

  const spts = [];
  const add_stem_points = function (pts, w0, w1, every) {
    if (every === undefined || every === null) every = 1;
    const n = pts.length;
    for (let i = 1; i <= n; i += every) {                  // индекс Lua
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
    mains[k] = pts;                                         // mains[1..NSTEM], как в Lua
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
    place(L_BLOOM, fx, fy, 90, () => F.lily(rng.fork(), s));
    disc(fx, fy, 1.05 * s, 0.85);
    blooms.push([fx, fy, s]);
    starCenters.push([fx, fy + 0.12 * s, s]);
    for (let k = 2; k <= NSTEM; k++) {
      const pts = mains[k];
      const p2 = pts[pts.length - 1], q2 = pts[pts.length - 3];
      const [ax, ay] = norm(p2[0] - q2[0], p2[1] - q2[1]);
      const tip = spring > 0.5 ? "bud" : autumn > 0.5 ? "seedhead" : null;
      if (k === 2) {
        const s2 = layout.range(1.0, 1.2);
        if (tip === "bud") place(L_BLOOM, p2[0], p2[1], deg(ax, ay), () => F.bud(rng.fork(), 0.95 * s2));
        else if (tip === "seedhead") place(L_AIRY, p2[0] + ax * 0.15, p2[1] + ay * 0.15, 90, () => F.seedhead(rng.fork(), 0.75 * s2));
        else {
          const lx = p2[0] + ax * 0.25 * s2, ly = p2[1] + ay * 0.25 * s2;
          place(L_BLOOM, lx, ly, deg(ax, ay), () => F.lily(rng.fork(), s2));
          starCenters.push([lx + ax * 0.12 * s2, ly + ay * 0.12 * s2, s2]);
        }
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
      place(L_BLOOM, gxp, gyp, 90, () => F.ghost(0.62, () => F.flower(rng.fork(), s)));
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
        const i = floor(pts.length * (0.25 + 0.3 * j / nl));    // индекс Lua
        const p = pts[i - 1], q = pts[i];
        const a = deg(q[0] - p[0], q[1] - p[1]) + (j % 2 === 0 ? 1 : -1) * layout.range(40, 60);
        const ls = layout.range(0.45, 0.75);
        place(L_LEAF, p[0], p[1], a, () => { ink.scale(ls); F.leaflet(rng.fork()); });
        disc(p[0] + cos(a * rad) * ls * 0.5, p[1] + sin(a * rad) * ls * 0.5, 0.25 * ls, 0.7);
      }
    }
    return pts;
  };

  // отметки из текста (\florilegiumbloom, заголовки) — только в TeX; здесь их нет

  // ---------------------------------------------------------- visitors
  const tangent = function (pts, i) {                      // i — индекс Lua
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
      // за пределами эталона: на коротком стебле (низкий лист — заставка, конец главы)
      // Lua упал бы на pts[i] = nil; здесь улитка просто не садится на этот стебель
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
      if (!p) continue;                                    // за пределами эталона, как у улитки
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
    for (let i = 2; i <= pts.length - 4; i++) {           // индекс Lua
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
          if (free_at(mx, my) >= 0.30 * Lf) { ok = true; break; }
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
                F.leaf(r1, { w, depth, bend, allowHistorical: false });
              };
              if (copper) ink.in_accent(leaf); else if (spring > 0) F.ghost(0.3 * spring, leaf); else leaf();
            });
          } else {
            const bend = -side * layout.range(0.1, 0.3);
            place(L_LEAF, pts[i - 1][0], pts[i - 1][1], a, () => { ink.scale(Lfc); F.leaflet(rng.fork(), { bend }); });
          }
          for (const f of [0.3, 0.55, 0.8]) disc(pts[i - 1][0] + ux * Lf * f, pts[i - 1][1] + uy * Lf * f, 0.30 * Lf, 0.85);
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
    // Зодиакальная статуя всегда сохраняет вертикаль: ветвь задаёт только наклон ±28°.
    // Направление mx/my одновременно задаёт поворот и положение защитного центра.
    let ma = deg(ax, ay), mx = ax, my = ay;
    if (pick.name.startsWith("historical")) {
      const turn = ((ma - 90 + 540) % 360) - 180;
      ma = 90 + max(-28, min(28, turn)); mx = cos(ma * rad); my = sin(ma * rad);
    }
    let ox = px - mx * pick.off(s), oy = py - my * pick.off(s);
    if (pick.hang) { ox = px - dx * 0.2 * s; oy = py + 0.45 * s; }
    nbranch = nbranch + 1;
    if (pick.fly) {
      const a = pick.name === "bee" ? layout.range(0, 360) : 90 + layout.sym(50);
      // аргументы arrive(...) в Lua вычисляются и без анимации: два числа раскладки
      layout.range(0, 360); layout.sym(0.8);
      place(pick.layer, px, py, a, () => pick.draw(rng.fork(), s));
    } else {
      if (dist(ox, oy, S[0], S[1]) > 0.12) branch_to(S, ox, oy, pick.hang ? dx : mx, pick.hang ? -0.3 : my, 0.04);
      const a = pick.hang ? 90 : ma;
      place(pick.layer, ox, oy, a, () => pick.draw(rng.fork(), s));
      if (pick.name === "flower") blooms.push([ox, oy, s]);
      else if (pick.name === "lily") starCenters.push([ox + ax * 0.12 * s, oy + ay * 0.12 * s, s]);
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
          sea.sym(0.6); sea.sym(0.3);                       // sway, x0 — только для анимации, но берутся всегда
          place(L_AIRY, bx, by, pa, () => { ink.scale(ps); F.petal(rng.fork(), { tone: pt, heart: false }); });
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
        ink.stroke(tone(0.1), 0.30, 0.66, false, "[1.10 1.45] 0");
        place(L_BLOOM, ox, oy, deg(ax, ay), () => F.bud(rng.fork(), min(0.6, f * 1.7)));
      } else {
        // Маленькое связное созвездие вместо нескольких случайных звёзд на ножках.
        ink.layer(L_STEM);
        ink.moveto(S[0], S[1]);
        ink.curveto(S[0] + S[2] * 0.1, S[1] + S[3] * 0.1, (S[0] + px) / 2, (S[1] + py) / 2 + 0.05, px, py);
        ink.stroke(tone(0.12), 0.25, 0.72, false, "[1.10 1.45] 0");
        place(L_AIRY, px, py, deg(ax, ay), () => F.cyme(rng.fork(), min(0.58, f * 1.45)));
      }
    } else if (sd >= 0.75 && accents < 6 * D && f > 0.22 && px < g.colright) {
      accents = accents + 1;
      if (layout.chance(0.6)) place(L_AIRY, px, py, 90, () => F.sparkle(rng.fork(), 0.13));
      else place(L_AIRY, px, py, 90, () => F.rosette(rng.fork(), 0.12));
    }
    disc(px, py, max(f, 0.3), 1);
  }

  // -------------------------------------- 5.5 long, open orbital gestures
  // Отдельный RNG: сами орбиты не меняют ни один последующий выбор мотива.
  const orbitRng = ink.rng(g.seed * 15485863 + 5077);
  const orbitCandidates = [];
  for (let si = 0; si < starCenters.length; si++) {
    const S = starCenters[si];
    for (let bi = 0; bi < blooms.length; bi++) {
      const P = blooms[bi], d = dist(S[0], S[1], P[0], P[1]);
      if (d >= 1.55 && d <= 5.2)
        orbitCandidates.push({ si, bi, score: d + orbitRng.range(-0.32, 0.32) });
    }
  }
  orbitCandidates.sort((a, b) => a.score - b.score);
  const usedStars = new Set(), usedPlanets = new Set();
  const orbitWanted = orbitRng.chance(0.45) ? 2 : 1;
  let orbitCount = 0;
  for (const c of orbitCandidates) {
    if (orbitCount >= orbitWanted) break;
    if (usedStars.has(c.si) || usedPlanets.has(c.bi)) continue;
    const S = starCenters[c.si], P = blooms[c.bi];
    ink.layer(L_AIRY); // поверх дальних созвездий, но под планетами и звёздами
    F.system_orbit(S[0], S[1], P[0], P[1],
      orbitRng.range(0.28, 0.38), orbitRng.range(-10, 10), 0.48);
    usedStars.add(c.si); usedPlanets.add(c.bi); orbitCount++;
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

  // Небесное лицо стоит в настоящей геометрической точке роста.
  if (F.root_body) {
    ink.layer(L_BLOOM);
    F.root_body(root[0], root[1]);
  }

  // assemble: a safety clip a little outside the regions, then the layers
  ink.tag(null);
  ink.layer(0);
  for (const r of rects) {
    const xr = r[2] + (r === col ? 0.25 : 0.3);
    ink.poly([[r[0] - 0.25, r[1] - 0.3], [xr, r[1] - 0.3], [xr, r[3] + 0.3], [r[0] - 0.25, r[3] + 0.3]], true);
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
