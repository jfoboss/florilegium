// Bundles the engines for ePub: dist/florilegium-garden.js (the flower garden,
// the live part-title page and the chapter ornaments) and
// dist/florilegium-cosmos.js (the cosmos ornament, a separate theme of its own).
"use strict";
const fs = require("fs");
const path = require("path");
const js = path.resolve(__dirname, "..");

const SRC = ["detmath.js", "fmt.js", "ink.js", "flora.js", "grow.js", "page.js", "ornaments.js"]
  .map((m) => "src/" + m);
const COSMOS = ["cosmos/cosmos.js", "cosmos/cosmicflora.js", "cosmos/cosmicgrow.js", "cosmos/index.js"];

const lic = fs.readFileSync(process.argv[2] || path.resolve(__dirname, "../../LICENSE"), "utf8").trim();

// Modules are registered under their paths relative to js/, and every static
// require("./x") / require("../x") is rewritten to that name, so a module can
// sit in src/ or in cosmos/ and find its neighbours either way.
const resolveSpec = (from, spec) =>
  path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
const rewrite = (from, code) =>
  code.replace(/require\("((?:\.{1,2}\/)[^"]+)"\)/g, (m, spec) => `require("${resolveSpec(from, spec)}")`);

function header(title) {
  return [
    "/*! " + title,
    " * Original engine: https://github.com/kevinraymond/florilegium. JavaScript port (c) 2026 jfoboss.",
    " * " + lic.split("\n").join("\n * ").replace(/ \* $/gm, " *"),
    " */",
    "(function (root) {",
    "var defs = {}, cache = {};",
    "function req(n) { n = n.replace(/^\\.\\//, \"\"); if (cache[n]) return cache[n].exports;",
    "  var m = { exports: {} }; cache[n] = m; defs[n](m, m.exports, req); return m.exports; }",
  ];
}

function build(title, mods, tail, outName) {
  const out = header(title);
  for (const m of mods) {
    out.push(`defs[${JSON.stringify(m)}] = function (module, exports, require) {`);
    out.push(rewrite(m, fs.readFileSync(path.join(js, m), "utf8")));
    out.push("};");
  }
  out.push(tail);
  out.push("})(typeof window !== \"undefined\" ? window : this);");
  out.push(fs.readFileSync(path.join(js, "src/shmuc.js"), "utf8"));
  out.push(fs.readFileSync(path.join(js, "src/chapter.js"), "utf8"));
  const file = path.resolve(__dirname, "../dist", outName);
  fs.writeFileSync(file, out.join("\n"));
  console.log(file, fs.statSync(file).size, "bytes");
}

build(
  "florilegium-garden: the florilegium garden in JS for ePub (a port of the Lua, deterministic math).",
  SRC,
  'var O = req("src/ornaments.js");\n' +
  'root.FlorilegiumGarden = { page: req("src/page.js").page, band: O.band, tailgarden: O.tailgarden, vignette: O.vignette, tile: O.tile, version: 2 };',
  "florilegium-garden.js"
);

build(
  "florilegium-cosmos: the cosmos ornament for ePub, a theme of its own next to the flower garden.",
  SRC.concat(COSMOS),
  'var C = req("cosmos/index.js");\n' +
  'root.FlorilegiumGarden = { page: C.page, atlas: C.atlas, band: C.band, tailgarden: C.tailgarden, vignette: C.vignette, tile: C.tile, plan: C.plan, version: 2, cosmos: C.version };',
  "florilegium-cosmos.js"
);
