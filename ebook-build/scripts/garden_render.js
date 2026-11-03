// garden_render.js — украшения глав движком florilegium на JS (florilegium-garden.js рядом).
//   node garden_render.js jobs.json
// jobs.json: [{ "kind": "band" | "vignette" | "tile", "seed": N, "ink": "2456C4", "accent": "B4662F",
//               "season": "summer", "novisitors": false, "width": 128, "height": 80, "out": "x.svg" }, ...]
// Пишет SVG; растр и обрезку делает make_gardens.py.
"use strict";
const fs = require("fs");
const path = require("path");
global.window = {};
require(path.join(__dirname, "florilegium-garden.js"));
const F = global.window.FlorilegiumGarden;
const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const j of jobs) {
  const o = { seed: j.seed, ink: j.ink, accent: j.accent };
  if (j.season && j.season !== "summer") o.season = j.season;
  if (j.novisitors) o.visitors = false;
  let svg;
  if (j.kind === "band") svg = F.band(Object.assign(o, { width: j.width, height: j.height }));
  else if (j.kind === "vignette") svg = F.vignette(o);
  else if (j.kind === "tile") svg = F.tile(o);
  else throw new Error("garden_render: неизвестный вид " + j.kind);
  fs.writeFileSync(j.out, svg);
}
console.log("ok " + jobs.length);
