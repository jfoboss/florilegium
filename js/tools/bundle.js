// Bundles the engine, the chapter ornaments, the live part-title page and the live chapter
// ornaments into one file for ePub: dist/florilegium-garden.js
"use strict";
const fs = require("fs");
const path = require("path");
const js = path.resolve(__dirname, "../src");
const mods = ["detmath.js", "fmt.js", "ink.js", "flora.js", "grow.js", "page.js", "ornaments.js"];
const lic = fs.readFileSync(process.argv[2] || path.resolve(__dirname, "../../LICENSE"), "utf8").trim();
const out = [
  "/*! florilegium-garden: the florilegium garden in JS for ePub (a port of the Lua, deterministic math).",
  " * Original engine: https://github.com/kevinraymond/florilegium. JavaScript port (c) 2026 jfoboss.",
  " * " + lic.split("\n").join("\n * ").replace(/ \* $/gm, " *"),
  " */",
  "(function (root) {",
  "var defs = {}, cache = {};",
  "function req(n) { n = n.replace(/^\\.\\//, \"\"); if (cache[n]) return cache[n].exports;",
  "  var m = { exports: {} }; cache[n] = m; defs[n](m, m.exports, req); return m.exports; }",
];
for (const m of mods) {
  out.push(`defs[${JSON.stringify(m)}] = function (module, exports, require) {`);
  out.push(fs.readFileSync(path.join(js, m), "utf8"));
  out.push("};");
}
out.push("var O = req(\"ornaments.js\");");
out.push("root.FlorilegiumGarden = { page: req(\"page.js\").page, band: O.band, tailgarden: O.tailgarden, vignette: O.vignette, tile: O.tile, version: 2 };");
out.push("})(typeof window !== \"undefined\" ? window : this);");
out.push(fs.readFileSync(path.join(js, "shmuc.js"), "utf8"));
out.push(fs.readFileSync(path.join(js, "chapter.js"), "utf8"));
const file = path.resolve(__dirname, "../dist/florilegium-garden.js");
fs.writeFileSync(file, out.join("\n"));
console.log(file, fs.statSync(file).size, "bytes");
