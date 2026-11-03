// The bundles are the engine verbatim, so a render through the bundle must be
// byte for byte the render through the sources. Checks both bundles:
// florilegium-garden.js (the flower garden, js/src) and florilegium-cosmos.js
// (the cosmos ornament, js/cosmos). Run after `node tools/bundle.js`.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

const root = path.join(__dirname, "..");
function loadBundle(file) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "dist", file), "utf8"), sandbox,
    { filename: file });
  return sandbox.window.FlorilegiumGarden;
}

const gardenSrc = (() => {
  const P = require("../src/page.js"), O = require("../src/ornaments.js");
  return { page: P.page, band: O.band, tailgarden: O.tailgarden,
    vignette: O.vignette, tile: O.tile };
})();
const cosmosSrc = require("../cosmos/index.js");

const sheet = { left: "36mm", right: "12mm", top: "36mm", bottom: "12mm",
  headsep: "0mm", headheight: "0pt", textend: "50mm" };
const colors = { ink: "2456C4", accent: "B4662F" };

let n = 0, bad = 0;
function cmp(name, a, b) {
  n++;
  if (a !== b) { bad++; console.log("FAIL", name); }
}

function checkPair(tag, A, B, kinds, seeds, papers, extras) {
  for (const seed of seeds) {
    for (const paper of papers) {
      for (const extra of extras) {
        const o = Object.assign({ seed, paper }, sheet, colors, extra);
        cmp(`${tag} page ${seed} ${paper} ${JSON.stringify(extra)}`, A.page(o).svg, B.page(o).svg);
      }
    }
  }
  for (const seed of [1, 7, 42]) {
    for (const kind of kinds) {
      if (kind === "band" || kind === "tailgarden") {
        const o = Object.assign({ seed, width: 128, height: kind === "band" ? 80 : 60 }, colors);
        cmp(`${tag} ${kind} ${seed}`, A[kind](o), B[kind](o));
      } else if (kind === "atlas") {
        cmp(`${tag} atlas ${seed}`, A.atlas(Object.assign({ seed }, colors)).svg,
                                     B.atlas(Object.assign({ seed }, colors)).svg);
      } else {
        cmp(`${tag} ${kind} ${seed}`, A[kind](Object.assign({ seed }, colors)),
                                      B[kind](Object.assign({ seed }, colors)));
      }
    }
  }
}

const fullGrid = [
  [1, 2, 3, 5, 7, 8, 13, 42, 101, 777],
  ["120x200", "90x180", "160x200"],
  [{}, { season: "spring" }, { season: "autumn" }, { age: 0.33 },
   { visitors: false }, { density: 0.5 }, { density: 0.2 }, { intensity: 0.5 },
   { mirror: true }],
];
// The flower garden is cheap to grow; the cosmos page is a much bigger drawing,
// so it gets a smaller grid of the same shape.
const cosmosGrid = [
  [1, 7, 42],
  ["120x200"],
  [{}, { season: "autumn" }, { mirror: true }],
];
checkPair("garden", loadBundle("florilegium-garden.js"), gardenSrc,
  ["band", "tailgarden", "vignette", "tile"], ...fullGrid);
checkPair("cosmos", loadBundle("florilegium-cosmos.js"), cosmosSrc,
  ["atlas", "band", "tailgarden", "vignette", "tile"], ...cosmosGrid);

console.log("bundles " + n + ", failures " + bad);
process.exit(bad ? 1 : 0);
