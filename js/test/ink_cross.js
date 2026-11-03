// Cross-check of ink.js against the reference florilegium-ink.lua (+ detmath); mirrors test/ink_case.lua.
"use strict";
const { LUA, refdir } = require("./ref.js");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const D = require("../src/detmath.js");
const ink = require("../src/ink.js");

const buf = new DataView(new ArrayBuffer(8));
const hx = (x) => { buf.setFloat64(0, x); let s = ""; for (let i = 0; i < 8; i++) s += buf.getUint8(i).toString(16).padStart(2, "0"); return s; };
const L = [];
const emit = (tag, ...v) => L.push([tag, ...v.map((x) => typeof x === "number" ? hx(x) : String(x))].join(" "));
const ptsOut = (tag, pts) => L.push([tag, ...pts.map((p) => hx(p[0]) + "," + hx(p[1]))].join(" "));
const streams = [];
ink.set_sink((s) => streams.push(s));

for (const seed of [0, 1, 7, 42, 123456789, 4294967295, 3.7, 9876543210]) {
  const r = ink.rng(seed);
  for (let k = 1; k <= 20; k++) emit("u", r.u());
  emit("rng", r.range(-2, 3), r.sym(1.5), r.int(1, 7), String(r.chance(0.4)), r.normal());
  const f = r.fork();
  emit("fork", f.u(), f.u(), r.save());
}
let r = ink.rng(5);
const n1 = ink.noise1(r), fb = ink.fbm1(r, 4);
for (let k = -20; k <= 40; k++) emit("noise", n1(k * 0.37), fb(k * 0.21));
for (let t = 0; t <= 1.0001; t += 0.05) { const c = ink.tone(t); emit("tone", c[0], c[1], c[2]); }
ink.set_ink(0x5B / 255, 0x2A / 255, 0x1F / 255);
for (let i = 0; i <= 100; i++) { const c = ink.tone(i / 100); emit("ramp", c[0], c[1], c[2]); }
ink.set_accent(0.71, 0.40, 0.18);
ink.in_accent(() => { const c = ink.tone(0.4); emit("acc", c[0], c[1], c[2]); });
let c = ink.accent(0.3); emit("accent", c[0], c[1], c[2]);
c = ink.accent(-0.2); emit("accent", c[0], c[1], c[2]);
ink.set_lift(0.3); c = ink.tone(0.2); emit("lift", c[0], c[1], c[2]); ink.set_lift(0);
ink.set_pale(0.25); c = ink.tone(0.2); emit("pale", c[0], c[1], c[2]); c = ink.accent(); emit("pale", c[0], c[1], c[2]); ink.set_pale(0);
ink.set_ink(0x24 / 255, 0x56 / 255, 0xC4 / 255);

const rr = ink.rng(77);
const rp = (n) => { const t = []; for (let i = 0; i < n; i++) t.push([rr.range(-5, 5), rr.range(-5, 5)]); return t; };
ink.set_transform(ink.page_transform(12.1));
ink.push(); ink.translate(3.3, 4.4); ink.rotate(27.5); ink.scale(0.8, 1.3);
emit("unit", ink.unit()); emit("topage", ...ink.to_page(1.5, -2.25));
for (let k = 1; k <= 30; k++) {
  const p = rp(2 + k % 7);
  ink.layer(k % 4);
  if (k % 5 === 0) { ink.poly(p, k % 2 === 0); ink.fill(ink.tone(k / 30), 0.6 + (k % 3) * 0.2, k % 2 === 1); }
  else if (k % 5 === 1) { ink.smooth(p, k % 2 === 0, 0.5 + k % 3); ink.stroke(ink.tone(0.3), 0.25 * k, k % 3 === 0 ? 0.5 : null, k % 4 === 0, k % 6 === 1 ? "[2 2] 0" : null); }
  else if (k % 5 === 2) { ink.circle(p[0][0], p[0][1], 0.3 * k); ink.fill(ink.accent(0.1)); }
  else if (k % 5 === 3) { ink.taper(p[0][0], p[0][1], p[1][0], p[1][1], 1, 2, 3, 1, 0.2, 0.05); ink.fill(ink.tone(0.5), 0.35); }
  else { ink.moveto(0, 0); ink.lineto(1, 2); ink.curveto(1, 2, 3, 4, 5, 6); ink.close(); ink.clip(); ink.flood(ink.tone(0.9), -1, -1, 1, 1); ink.unclip(); }
}
ink.pop();
ink.set_transform(ink.page_transform());
ink.smooth(rp(9), true); ink.fill(ink.paper);
ink.flush();
for (const s of streams) L.push("STREAM " + s);
const p = rp(12);
ptsOut("normals", ink.normals(p));
const s = ink.arclen(p); emit("arclen", s.total); ptsOut("arcs", s.map((v) => [v, 0]));
ptsOut("ribbon", ink.ribbon(p, (u) => 0.2 + 0.3 * u));
ptsOut("catmull", ink.catmull(p, 5));
ptsOut("bez", ink.sample(ink.bezier3(0, 0, 1, 3, 4, -1, 6, 2), 17, 0.1, 0.9));
const o = ink.blade((v) => [v * 2, D.sin(v * 3)], 14, (v) => 0.4 * D.sin(Math.PI * v),
  (v) => 0.3 * D.pow(v, 0.7), (v, side) => 0.05 * side * D.cos(9 * v));
ptsOut("blade", o); ptsOut("bladec", o.c); ptsOut("bladen", o.nrm);
ptsOut("blob", ink.blob(ink.rng(3), 1, 2, 0.7, 0.4, 0.3, 11));
ptsOut("blob9", ink.blob(ink.rng(4), -1, 0, 0.5, 0.5, 0.2));

const tmp = fs.mkdtempSync("/tmp/inkx-");
execFileSync(LUA, [path.join(__dirname, "ink_case.lua"), refdir(), path.join(tmp, "lua.txt")]);
const ref = fs.readFileSync(path.join(tmp, "lua.txt"), "utf8").trim().split("\n");
let bad = 0;
const LL = L.join("\n").split("\n");
L.length = 0; L.push(...LL);
const n = Math.max(ref.length, L.length);
for (let i = 0; i < n; i++) {
  if (ref[i] !== L[i]) {
    if (bad++ < 5) {
      const a = (ref[i] || "").split(" "), b = (L[i] || "").split(" ");
      const j = a.findIndex((x, k) => x !== b[k]);
      console.log(`line ${i + 1} (${a[0]}), field ${j}: lua «${(a[j] || "").slice(0, 80)}» js «${(b[j] || "").slice(0, 80)}»`);
    }
  }
}
console.log(`lines: lua ${ref.length}, js ${L.length}; mismatches ${bad}`);
process.exit(bad ? 1 : 0);
