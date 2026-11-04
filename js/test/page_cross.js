// Whole-page cross-check: page.js against texlua lua/ref_page.lua ref det, byte for byte.
//   node test/page_cross.js [quick]
"use strict";
const { LUA, refdir } = require("./ref.js");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const page = require("../src/page.js");

const BASE = { paper: "120x200", left: "36mm", right: "12mm", top: "36mm", bottom: "12mm", headsep: "0mm", headheight: "0pt", textend: "50mm" };
const cases = [];
for (const seed of [1, 2, 6, 8]) cases.push(Object.assign({}, BASE, { seed }));
const quick = process.argv[2] === "quick";
if (!quick) {
  // e-reader screens: phone, tablet, landscape; no textend; mirror; seasons, density, no visitors
  const shapes = [
    { paper: "70x150", left: "22mm", right: "6mm", top: "20mm", bottom: "8mm" },
    { paper: "90x160", left: "28mm", right: "8mm", top: "24mm", bottom: "10mm", textend: "40mm" },
    { paper: "150x200", left: "48mm", right: "14mm", top: "30mm", bottom: "14mm", textend: "60mm" },
    { paper: "200x150", left: "60mm", right: "16mm", top: "24mm", bottom: "12mm", textend: "35mm" },
    { paper: "120x200", left: "12mm", right: "36mm", top: "36mm", bottom: "12mm", textend: "50mm" },
    { paper: "105.5x187.3", left: "33.3mm", right: "11mm", top: "30.25mm", bottom: "9.7mm", textend: "47.5mm" },
  ];
  const extras = [{}, { season: "spring" }, { season: "autumn" }, { season: "0.7" }, { density: "0.5" }, { density: "0.2" },
    { visitors: false }, { intensity: "0.6" }, { ink: "5B2A1F", accent: "2F66B4" }];
  let k = 0;
  for (const seed of [3, 11, 17, 42, 99, 123, 500, 777, 1001, 31337]) {
    for (const sh of shapes) {
      const o = Object.assign({ headsep: "0mm", headheight: "0pt" }, sh, { seed }, extras[k++ % extras.length]);
      cases.push(o);
    }
  }
  for (const seed of [1, 2, 6, 8]) for (const ex of extras.slice(1)) cases.push(Object.assign({}, BASE, { seed }, ex));
}
// bleed (#27): the clip open along the paper's edges, the SVG larger on every side;
// a part-title sheet, a mirrored one, a phone-sized one without textend, and quick mode too
for (const [seed, o] of [[3, {}], [7, { left: "12mm", right: "36mm" }], [11, { paper: "70x150", left: "22mm", right: "6mm", top: "20mm", bottom: "8mm", textend: undefined }]]) {
  const c = Object.assign({}, BASE, { seed, bleed: "14mm" }, o);
  if (c.textend === undefined) delete c.textend;
  cases.push(c);
}

const tmp = fs.mkdtempSync("/tmp/pagex-");
let bad = 0, tl = 0, tj = 0;
cases.forEach((o, i) => {
  const args = [path.join(__dirname, "../lua/ref_page.lua"), refdir(), "det", path.join(tmp, "r.svg")];
  for (const [k, v] of Object.entries(o)) args.push(k + "=" + v);
  let t = Date.now();
  let ref;
  try { execFileSync(LUA, args, { stdio: ["ignore", "ignore", "pipe"] }); ref = fs.readFileSync(path.join(tmp, "r.svg"), "utf8"); }
  catch (e) { ref = "ERR " + String(e.stderr || e).split("\n")[0]; }
  tl += Date.now() - t;
  t = Date.now();
  let js;
  try { js = page.page(o).svg; } catch (e) { js = "ERR " + e.message; }
  tj += Date.now() - t;
  if (js !== ref) {
    if (bad++ < 3) {
      let p = 0; while (p < ref.length && ref[p] === js[p]) p++;
      console.log(`MISMATCH #${i} ${JSON.stringify(o)} at char ${p} (lua ${ref.length}, js ${js.length}):\n  lua …${ref.slice(Math.max(0, p - 120), p + 80)}\n  js  …${js.slice(Math.max(0, p - 120), p + 80)}`);
    }
  }
});
console.log(`pages ${cases.length}, mismatches ${bad}; texlua ${tl} ms, js ${tj} ms (${(tj / cases.length).toFixed(0)} ms/page)`);
process.exit(bad ? 1 : 0);
