// Cross-check of flora.js against the reference florilegium-flora.lua (+ detmath): each primitive many times,
// at different scales (level of detail), rotations and in "ghost" mode.
// One case list serves both sides: for Lua it is printed as a table.
"use strict";
const { LUA, refdir } = require("./ref.js");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ink = require("../src/ink.js");
const flora = require("../src/flora.js");
const { fixed } = require("../src/fmt.js");
const buf = new DataView(new ArrayBuffer(8));
const hx = (x) => { buf.setFloat64(0, x); let r = ""; for (let i = 0; i < 8; i++) r += buf.getUint8(i).toString(16).padStart(2, "0"); return r; };

const PRIMS = {   // name -> call (same meaning for Lua and JS)
  petal: "o", petalp: "o", flower: "s", lily: "s", blossom: "s", floret: "s", floretstar: "s", bud: "s", bell: "s",
  leaf: "o", leaf0: "o", leaflet: "o", cyme: "s", sprig: "s", umbel: "s", seedhead: "s", tendril: "s",
  sparkle: "s", rosette: "s", hedera: "s", butterfly: "s", bee: "s", snail: "s", bird: "s", birdl: "s",
  stem: "x", stemtip: "x", branch: "x", ghostflower: "s", mottle: "x", streak: "x",
};
const cases = [];
let id = 0;
for (const name of Object.keys(PRIMS)) {
  for (const scale of [0.12, 0.5, 1.4]) {
    for (const lift of [0, 0.62]) {
      id++;
      cases.push({ name, seed: 1000 + id * 7, scale, rot: (id * 37) % 360, lift, s: 0.5 + (id % 5) * 0.3, mirror: id % 2 ? 0 : 21.0 });
    }
  }
}

function run(c) {
  const out = [];
  ink.set_sink((s) => out.push(s));
  ink.set_transform(ink.page_transform(c.mirror ? c.mirror : null));
  ink.translate(5, 7); ink.rotate(c.rot); ink.scale(c.scale);
  const rng = ink.rng(c.seed);
  const old = ink.set_lift(c.lift);
  const n = c.name, s = c.s;
  let ret = "";
  switch (n) {
    case "petal": flora.petal(rng, {}); break;
    case "petalp": flora.petal(rng, { shape: "pointed", heart: false }); break;
    case "flower": flora.flower(rng, s); break;
    case "lily": flora.lily(rng, s); break;
    case "blossom": flora.blossom(rng, s * 0.4); break;
    case "floret": flora.floret(rng, s * 0.1); break;
    case "floretstar": flora.floret(rng, s * 0.3, { star: true, tone: 0 }); break;
    case "bud": flora.bud(rng, s); break;
    case "bell": flora.bell(rng, s); break;
    case "leaf": flora.leaf(rng, {}); break;
    case "leaf0": flora.leaf(rng, { depth: 0 }); break;
    case "leaflet": flora.leaflet(rng, {}); break;
    case "cyme": flora.cyme(rng, s * 2, { fork: true }); break;
    case "sprig": flora.sprig(rng, s * 2); break;
    case "umbel": flora.umbel(rng, s); break;
    case "seedhead": flora.seedhead(rng, s); break;
    case "tendril": flora.tendril(rng, s); break;
    case "sparkle": flora.sparkle(rng, s * 0.2); break;
    case "rosette": flora.rosette(rng, s * 0.2); break;
    case "hedera": { const r = flora.hedera(rng, s); ret = fixed(r[0], 6) + " " + fixed(r[1], 6); break; }
    case "butterfly": flora.butterfly(rng, s * 2, { open: 0.7 }); break;
    case "bee": flora.bee(rng, s); break;
    case "snail": flora.snail(rng, s); break;
    case "bird": flora.bird(rng, s * 2); break;
    case "birdl": flora.bird(rng, s * 2, { facing: -1 }); break;
    case "stem": flora.stem(flora.walk(0, 0, (x) => 90 + 30 * x, 3 * s, 20), 0.05, 0.01); break;
    case "stemtip": flora.stem(flora.walk(0, 0, (x) => 80 - 20 * x, 3 * s, 20), 0.08, 0.02, ink.tone(0.2), 0.8, 0.5); break;
    case "branch": { const p = flora.branch_path(rng, 0, 0, 0, 1, s * 2, s, 0.6, 0.8); flora.stem(p, 0.03, 0.01); break; }
    case "ghostflower": flora.ghost(null, () => flora.flower(rng, s)); break;
    case "mottle": ink.circle(0, 0, 1); ink.clip(); flora.mottle(rng, -1, -1, 1, 1, 8, 0.2, 0.2, 0.5, 6); ink.unclip(); break;
    case "streak": flora.streak((v) => [v, v * v], 12, 0.1, 0.01, ink.white, 0.7); break;
  }
  ink.set_lift(old);
  ink.flush();
  return out.join("\n") + "\nRET " + ret + " U " + hx(rng.u());
}

const luaCase = (c) => `{ name = "${c.name}", seed = ${c.seed}, scale = ${c.scale}, rot = ${c.rot}, lift = ${c.lift}, s = ${c.s}, mirror = ${c.mirror} }`;
const tmp = fs.mkdtempSync("/tmp/florax-");
fs.writeFileSync(path.join(tmp, "cases.lua"), "return {\n" + cases.map(luaCase).join(",\n") + "\n}\n");
const t0 = Date.now();
execFileSync(LUA, [path.join(__dirname, "flora_case.lua"), refdir(), path.join(tmp, "cases.lua"), path.join(tmp, "lua.txt")],
  { maxBuffer: 1 << 30 });
const tl = Date.now() - t0;
const ref = fs.readFileSync(path.join(tmp, "lua.txt"), "utf8").split("\n=====\n");
const t1 = Date.now();
let bad = 0;
const byName = {};
cases.forEach((c, i) => {
  const js = run(c);
  const ok = js === ref[i];
  byName[c.name] = (byName[c.name] || 0) + (ok ? 0 : 1);
  if (!ok && bad++ < 4) {
    const a = ref[i] || "", b = js;
    let k = 0; while (k < a.length && a[k] === b[k]) k++;
    console.log(`MISMATCH ${c.name} (seed ${c.seed}, scale ${c.scale}, ghost ${c.lift}) at char ${k}:\n  lua …${a.slice(Math.max(0, k - 60), k + 60)}\n  js  …${b.slice(Math.max(0, k - 60), k + 60)}`);
  }
});
const tj = Date.now() - t1;
console.log(`cases ${cases.length}, mismatches ${bad}; texlua ${tl} ms, js ${tj} ms`);
const badNames = Object.entries(byName).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`);
if (badNames.length) console.log("by primitive:", badNames.join(", "));
process.exit(bad ? 1 : 0);
