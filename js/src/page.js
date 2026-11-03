// page.js — a port of the needed parts of florilegium-svg.lua and florilegium.lua (florilegium, Kevin Raymond, MIT):
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
// TeX-style lengths, colors as xcolor gives them, page layout, garden, SVG.
// Only the flora theme, default summer, no header (head=false), no author page.
"use strict";
const ink = require("./ink.js");
const grow = require("./grow.js");
const { fixed } = require("./fmt.js");

const floor = Math.floor;
const idiv = (a, b) => floor(a / b);          // Lua integer // for non-negatives
const imod = (a, b) => a - floor(a / b) * b;

// ---------------------------------------------------------------- lengths (TeX scan_dimen)
const UNITS = { pt: [1, 1], mm: [7227, 2540], cm: [7227, 254], in: [7227, 100], bp: [7227, 7200] };
function sp(s) {
  s = String(s);
  const m = s.match(/^\s*([-+]?)(\d*)\.?(\d*)\s*([A-Za-z]*)\s*$/);
  if (!m || m[2] + m[3] === "") throw new Error("florilegium: not a length: '" + s + "'");
  const [, sign, int, frac, unit] = m;
  const u = UNITS[unit === "" ? "mm" : unit];
  if (!u) throw new Error("florilegium: unknown unit '" + unit + "' in '" + s + "'");
  let v = int !== "" ? parseInt(int, 10) : 0, f = 0;
  if (frac !== "") {
    let a = 0;
    for (let k = Math.min(frac.length, 17); k >= 1; k--) a = idiv(a + Number(frac[k - 1]) * 131072, 10);
    f = idiv(a + 1, 2);
  }
  if (u[0] !== 1) {
    const q = idiv(v * u[0], u[1]), r = imod(v * u[0], u[1]);
    f = idiv(u[0] * f + 65536 * r, u[1]);
    v = q + idiv(f, 65536);
    f = imod(f, 65536);
  }
  const n = v * 65536 + f;
  return sign === "-" ? -n : n;
}

// ---------------------------------------------------------------- colors as in xcolor
function print_scaled(s) {
  const out = [String(idiv(s, 65536)), "."];
  let delta = 10;
  s = 10 * imod(s, 65536) + 5;
  do {
    if (delta > 65536) s = s + 0x8000 - 50000;
    out.push(String(idiv(s, 65536)));
    s = 10 * imod(s, 65536); delta = delta * 10;
  } while (!(s <= delta));
  return out.join("");
}
function xcolor(n) {
  const q = idiv(n, 255); let r = imod(n, 255); const digits = [];
  for (let k = 1; k <= 6; k++) { r = r * 10; digits.push(idiv(r, 255)); r = imod(r, 255); }
  let s = sp(q + "." + digits.slice(0, 5).join("") + "pt");
  if (digits[5] > 4) s = s + 1;
  return Number(print_scaled(s).replace(/\.0$/, ""));
}
function html(h) {
  h = String(h).replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("florilegium: not a color (RRGGBB): '" + h + "'");
  return [xcolor(parseInt(h.slice(0, 2), 16)), xcolor(parseInt(h.slice(2, 4), 16)), xcolor(parseInt(h.slice(4, 6), 16))];
}

// ---------------------------------------------------------------- PDF -> SVG
function hex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, floor(Number(v) * 255 + 0.5)));
  return "#" + [c(r), c(g), c(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const num = (t) => t.replace(/\.0$/, "");
const fmtg = (x) => String(Number(x.toPrecision(6)));   // %g for fractions 0..1

function translate(stream, out, id) {
  let st = { fill: "#000000", stroke: "#000000", w: "1", op: 1, mult: false };
  const stack = [];
  let open = 0, args = [], d = [], arr = null, nclip = 0, clip = false;
  const paint = (stroke) => {
    const a = ['<path d="', d.join(""), '"'];
    if (stroke) {
      a.push(' fill="none" stroke="' + st.stroke + '" stroke-width="' + st.w + '"');
      if (st.dash) a.push(' stroke-dasharray="' + st.dash + '"');
      if (st.op < 1) a.push(' stroke-opacity="' + fmtg(st.op) + '"');
    } else {
      a.push(' fill="' + st.fill + '"');
      if (st.op < 1) a.push(' fill-opacity="' + fmtg(st.op) + '"');
    }
    if (st.mult) a.push(' style="mix-blend-mode:multiply"');
    a.push("/>");
    out.push(a.join(""));
  };
  const toks = stream.split(/\s+/);
  for (const t of toks) {
    if (t === "") continue;
    const c = t.charCodeAt(0);
    if (arr) {
      const closed = t.endsWith("]"); const v = closed ? t.slice(0, -1) : t;
      if (v !== "") arr.push(num(v));
      if (closed) { args.push(arr); arr = null; }
    } else if (c === 91) {
      arr = [];
      const r = t.slice(1); const closed = r.endsWith("]"); const v = closed ? r.slice(0, -1) : r;
      if (v !== "") arr.push(num(v));
      if (closed) { args.push(arr); arr = null; }
    } else if ((c >= 48 && c <= 57) || c === 45 || c === 46 || c === 47) {
      args.push(t);
    } else {
      const n = args.length;
      if (t === "m" || t === "l") d.push((t === "m" ? "M" : "L") + num(args[n - 2]) + " " + num(args[n - 1]));
      else if (t === "c") d.push("C" + num(args[n - 6]) + " " + num(args[n - 5]) + " " + num(args[n - 4]) + " " +
        num(args[n - 3]) + " " + num(args[n - 2]) + " " + num(args[n - 1]));
      else if (t === "h") d.push("Z");
      else if (t === "f") { paint(false); d = []; }
      else if (t === "S") { paint(true); d = []; }
      else if (t === "W") clip = true;
      else if (t === "n") {
        if (clip) {
          nclip++;
          const cid = id + "c" + nclip;
          out.push('<clipPath id="' + cid + '"><path d="' + d.join("") + '"/></clipPath><g clip-path="url(#' + cid + ')">');
          open++; clip = false;
        }
        d = [];
      } else if (t === "q") { stack.push({ st: Object.assign({}, st), open }); open = 0; }
      else if (t === "Q") { for (let k = 0; k < open; k++) out.push("</g>"); const s = stack.pop(); st = s.st; open = s.open; }
      else if (t === "rg") st.fill = hex(args[n - 3], args[n - 2], args[n - 1]);
      else if (t === "RG") st.stroke = hex(args[n - 3], args[n - 2], args[n - 1]);
      else if (t === "w") st.w = num(args[n - 1]);
      else if (t === "d") { const a = args[n - 2]; st.dash = (Array.isArray(a) && a.length > 0) ? a.join(" ") : undefined; }
      else if (t === "gs") {
        const m = /^\/flo([am])(\d+)$/.exec(args[n - 1]);
        if (!m) throw new Error("florilegium: unknown graphics state " + args[n - 1]);
        st.op = Number(m[2]) / 100; st.mult = m[1] === "m";
      } else if (t === "J" || t === "j") { /* always round */ }
      else throw new Error("florilegium: cannot translate the PDF operator '" + t + "'");
      args = [];
    }
  }
  for (let k = 0; k < open; k++) out.push("</g>");
  return out;
}

// ---------------------------------------------------------------- layout (florilegium.geometry)
const SP_CM = 2.54 / (72.27 * 65536);
function geometry(dimen) {
  const inch = 2.54;
  const cm = (name) => dimen[name] * SP_CM;
  const g = { pw: cm("paperwidth"), ph: cm("paperheight"), textleft: inch + 0 * SP_CM + cm("oddsidemargin") };
  g.textright = g.textleft + cm("textwidth");
  if (g.pw - g.textright > g.textleft + 0.05) {
    g.mirror = true;
    const tl = g.textleft; g.textleft = g.pw - g.textright; g.textright = g.pw - tl;
  }
  g.ytop = g.ph - inch - cm("topmargin") - cm("headheight") - cm("headsep");
  g.ybot = g.ytop - cm("textheight");
  g.colright = g.textleft - 0.4;
  g.headrule = g.ytop + cm("headsep") - 0.1;
  g.footy = g.ybot - cm("footskip");
  return g;
}

const DEFAULTS = { paper: [ "210mm", "297mm" ], left: "68mm", right: "22mm", top: "32mm", bottom: "30mm",
  headsep: "8mm", headheight: "12pt", footskip: "30pt" };

// o: seed (integer ≥ 1), paper [w, h] (lengths) or "WxH" in mm, left right top bottom headsep headheight
// footskip, textend, season, density, intensity, visitors, ink, accent, background, id.
// Returns { svg, g, stats }.
function page(o) {
  o = Object.assign({}, o || {});
  for (const k of Object.keys(DEFAULTS)) if (o[k] === undefined || o[k] === null) o[k] = DEFAULTS[k];
  let paper = o.paper;
  if (typeof paper === "string") {
    const m = /^(\d+\.?\d*)x(\d+\.?\d*)$/.exec(paper);
    if (!m) throw new Error("florilegium: unknown paper '" + paper + "'");
    paper = [m[1] + "mm", m[2] + "mm"];
  }
  const pg = 1;
  const pw = sp(paper[0]), ph = sp(paper[1]);
  const L = sp(o.left), R = sp(o.right), T = sp(o.top), B = sp(o.bottom);
  const hh = sp(o.headheight), hs = sp(o.headsep), inch = sp("1in");
  const tw = pw - L - R, th = ph - T - B;
  if (tw <= 0 || th <= 0) throw new Error("florilegium: the margins leave no room for the text");
  const dimen = { paperwidth: pw, paperheight: ph, textwidth: tw, textheight: th,
    oddsidemargin: L - inch, topmargin: T - inch - hh - hs, headheight: hh, headsep: hs, footskip: sp(o.footskip) };

  const streams = [];
  ink.set_sink((s) => streams.push(s));
  const [ir, ig, ib] = html(o.ink || "2456C4");
  const [ar, ag, ab] = html(o.accent || "B4662F");
  ink.set_ink(ir, ig, ib); ink.set_accent(ar, ag, ab);
  const fx = Number(o.seed);
  if (!(fx >= 1)) throw new Error("florilegium: a seed is a positive integer");
  const seed = floor(fx) * 7919 + pg * 131;
  let age = o.season;
  if (age === undefined || age === null || age === "summer") age = undefined;
  else if (age === "spring") age = 0;
  else if (age === "autumn") age = 1;
  else { age = Number(age); if (Number.isNaN(age)) throw new Error("florilegium: a season is spring, summer, autumn or 0..1"); }
  const density = o.density !== undefined && o.density !== null && !Number.isNaN(Number(o.density)) ? Number(o.density) : 1;
  const intensity = o.intensity !== undefined && o.intensity !== null && !Number.isNaN(Number(o.intensity)) ? Number(o.intensity) : 1;
  const visitors = o.visitors !== false;

  const g = geometry(dimen);
  let spill = 0, spilly = 0;
  if (o.textend !== undefined && o.textend !== null) { spill = 1; spilly = g.ytop - sp(o.textend) * 2.54 / (72.27 * 65536); }
  g.marks = [];
  g.seed = seed; g.spill = spill; g.spilly = spilly; g.visitors = visitors; g.age = age; g.theme = undefined;
  if (density < 1) g.density = Math.max(0.03, density);
  const old = ink.set_pale(0.85 * (1 - Math.max(0, Math.min(1, intensity))));
  let stats;
  try {
    stats = grow.page(g).stats;
  } catch (e) {
    ink.take_recording(); ink.discard(); ink.set_lift(0); ink.set_pale(0);
    throw e;
  } finally {
    ink.set_pale(old);
    ink.set_sink(null);
  }
  ink.set_pale(0);

  const CM = 72 / 2.54;
  const W = g.pw * CM, H = g.ph * CM;
  const id = o.id || ("flo" + floor(Number(o.seed) || 0) + "-");
  const out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + fixed(g.pw * 10, 2) + 'mm" height="' + fixed(g.ph * 10, 2) +
    'mm" viewBox="0 0 ' + fixed(W, 2) + " " + fixed(H, 2) + '">'];
  if (o.background) {
    const h = String(o.background).replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("florilegium: not a color (RRGGBB): '" + h + "'");
    out.push('<rect width="' + fixed(W, 2) + '" height="' + fixed(H, 2) + '" fill="#' + h.toLowerCase() + '"/>');
  }
  out.push('<g transform="matrix(1 0 0 -1 0 ' + fixed(H, 2) + ')" stroke-linecap="round" stroke-linejoin="round">');
  streams.forEach((s, i) => translate(s, out, id + (i + 1)));
  out.push("</g></svg>\n");
  return { svg: out.join("\n"), g, stats };
}

module.exports = { page, sp, xcolor, html, translate, geometry };
