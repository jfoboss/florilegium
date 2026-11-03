// Smoke test of ornaments.js (no Lua reference: the ornaments exist only in JS): each ornament
// for a few seeds is a well-formed SVG string and the same on a second call.
"use strict";
const O = require("../src/ornaments.js");

const C = { ink: "2456C4", accent: "B4662F" };
const kinds = {
  band: (seed) => O.band(Object.assign({ seed, width: 128, height: 80 }, C)),
  tailgarden: (seed) => O.tailgarden(Object.assign({ seed, width: 110, height: 60 }, C)),
  vignette: (seed) => O.vignette(Object.assign({ seed }, C)),
  tile: (seed) => O.tile(Object.assign({ seed }, C)),
};
let n = 0, bad = 0;
const fail = (what) => { bad++; console.log("FAIL", what); };
for (const [name, fn] of Object.entries(kinds)) {
  for (const seed of [1, 7, 42]) {
    n++;
    const a = fn(seed), b = fn(seed);
    if (typeof a !== "string" || !a.startsWith("<svg")) { fail(name + " " + seed + ": not an <svg string"); continue; }
    if (!/<\/svg>\s*$/.test(a)) fail(name + " " + seed + ": no closing </svg>");
    const open = (a.match(/<g[ >]/g) || []).length, close = (a.match(/<\/g>/g) || []).length;
    if (open !== close) fail(name + " " + seed + ": <g> " + open + " vs </g> " + close);
    if (/NaN|undefined|Infinity/.test(a)) fail(name + " " + seed + ": NaN/undefined in output");
    if (a !== b) fail(name + " " + seed + ": not deterministic");
  }
}
console.log("ornaments " + n + ", failures " + bad);
process.exit(bad ? 1 : 0);
