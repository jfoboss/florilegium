// Smoke test of the cosmos ornament (js/cosmos, no Lua reference: the theme exists
// only in JS): a cosmic garden page, a star atlas and the chapter ornaments for a
// few seeds are well-formed SVG strings, the same on a second call, and different
// seeds give different drawings. The flower garden next to it (js/src) keeps its
// own checks (page_cross.js and the others).
"use strict";
const C = require("../cosmos/index.js");

const colors = { ink: "18345B", accent: "A9542D" };
const sheet = { paper: "120x200", left: "36mm", right: "12mm", top: "36mm", bottom: "12mm",
  headsep: "0mm", headheight: "0pt", textend: "50mm" };
const kinds = {
  page: (seed) => C.page(Object.assign({ seed }, sheet, colors)).svg,
  atlas: (seed) => C.atlas(Object.assign({ seed }, colors)).svg,
  band: (seed) => C.band(Object.assign({ seed, width: 128, height: 80 }, colors)),
  tailgarden: (seed) => C.tailgarden(Object.assign({ seed, width: 110, height: 60 }, colors)),
  vignette: (seed) => C.vignette(Object.assign({ seed }, colors)),
  tile: (seed) => C.tile(Object.assign({ seed }, colors)),
};
let n = 0, bad = 0;
const fail = (what) => { bad++; console.log("FAIL", what); };
// The vignette is a fixed composition (the seed only names the SVG ids);
// the other kinds are generative and must differ from seed to seed.
const generative = new Set(["page", "atlas", "band", "tailgarden", "tile"]);
for (const [name, fn] of Object.entries(kinds)) {
  let prev = null;
  for (const seed of [1, 3, 7, 42]) {
    n++;
    const a = fn(seed), b = fn(seed);
    if (typeof a !== "string" || !a.startsWith("<svg")) { fail(name + " " + seed + ": not an <svg string"); continue; }
    if (!/<\/svg>\s*$/.test(a)) fail(name + " " + seed + ": no closing </svg>");
    const open = (a.match(/<g[ >]/g) || []).length, close = (a.match(/<\/g>/g) || []).length;
    if (open !== close) fail(name + " " + seed + ": <g> " + open + " vs </g> " + close);
    if (/NaN|undefined|Infinity/.test(a)) fail(name + " " + seed + ": NaN/undefined in output");
    if (a !== b) fail(name + " " + seed + ": not deterministic");
    if (generative.has(name)) {
      if (prev !== null && a === prev) fail(name + " " + seed + ": same drawing as the previous seed");
      prev = a;
    }
  }
}
// plan stays a pure function of the seed: same seed, same special body
const p1 = C.plan(7), p2 = C.plan(7);
if (JSON.stringify(p1) !== JSON.stringify(p2)) fail("plan: not deterministic");
console.log("cosmos " + n + ", failures " + bad);
process.exit(bad ? 1 : 0);
