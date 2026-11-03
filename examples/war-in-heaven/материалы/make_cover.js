// Обложка примера: сад florilegium (движок из js/dist) на листе 100×160 мм,
// название — в пустом углу над «концом текста». node make_cover.js out.svg
"use strict";
const fs = require("fs");
const path = require("path");
global.window = {};
require(path.resolve(__dirname, "../../../js/dist/florilegium-garden.js"));
const F = global.window.FlorilegiumGarden;
const o = { seed: 7, ink: "2456C4", accent: "B4662F", paper: "100x160", left: "30mm", right: "8mm",
  top: "18mm", bottom: "10mm", headsep: "0mm", headheight: "0pt", textend: "74mm", id: "cover-" };
let svg = F.page(o).svg;
const W = 100 / 25.4 * 72, H = 160 / 25.4 * 72;      // pt
const x = (30 + 62 / 2) / 25.4 * 72;                 // середина текстового блока
const t = (s, y, size, extra) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" text-anchor="middle" font-family="FreeSerif, serif" fill="#1d2a52" ${extra || ""}>${s}</text>`;
const mm = (v) => v / 25.4 * 72;
const title = [
  `<rect x="0" y="0" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#fbf8f1"/>`,
].join("");
const words = [
  t("Юрий", mm(36), 11, 'letter-spacing="1.5"'),
  t("ВОЙНА", mm(56), 26, 'letter-spacing="3"'),
  t("в", mm(65), 14, 'font-style="italic"'),
  t("РАЮ", mm(78), 26, 'letter-spacing="3"'),
  `<line x1="${(x - mm(7)).toFixed(1)}" x2="${(x + mm(7)).toFixed(1)}" y1="${mm(83).toFixed(1)}" y2="${mm(83).toFixed(1)}" stroke="#B4662F" stroke-width="0.8"/>`,
  t("рассказ", mm(89.5), 10, 'font-style="italic" fill-opacity="0.75"'),
].join("");
svg = svg.replace(/(<svg[^>]*>)/, "$1" + title).replace(/<\/svg>\s*$/, words + "</svg>\n");
fs.writeFileSync(process.argv[2], svg);
