// chapter.js — live chapter ornaments: the headpiece regrows to the column width.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
//
// In paginated mode, a quiet garden band (60 mm, sparser and paler than the headpiece)
// goes under the last paragraph if it fits on the page; otherwise the vignette stays.
//
// Markup (written by the book builder):
//   <div class="ch-head"><svg data-florilegium-band="seed ink accent season [novisitors]" ...><image .../></svg></div>
//   <div class="ch-tail"><svg data-florilegium-tail="seed ink accent season [novisitors]" ...><image .../></svg></div>
// The images inside are the fallback: without the script, or on an error, they stay.
//
// One scale for the whole book: the headpiece is an 80 mm high band that takes about a
// third of the screen page; the chapter-end garden is measured with the same millimeters
// per pixel, so the flowers are the same size at the top and at the bottom.
(function () {
  "use strict";
  var F = window.FlorilegiumGarden;
  if (!F || !F.band || !window.DOMParser || !document.querySelector) return;
  var NS = "http://www.w3.org/2000/svg";
  var PT_MM = 25.4 / 72;
  var BAND_H = 80, BAND_SHARE = 0.3;     // mm; share of the page height
  var TAIL_H = 60;                       // mm: the quiet chapter-end band; if it doesn't fit, the vignette

  function data(el, attr) {
    var d = el.getAttribute(attr).split(" ");
    var o = { seed: +d[0], ink: d[1], accent: d[2] };
    if (d[3] && d[3] !== "summer") o.season = d[3];
    if (d[4] === "novisitors") o.visitors = false;
    return o;
  }

  function inset() {
    // the e-reader's top margin: where the page's first block starts
    var first = document.body && document.body.firstElementChild;
    var t = first ? first.getBoundingClientRect().top : 0;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return Math.max(0, Math.min(t + (window.pageYOffset || 0), vh / 4));
  }
  function pageHeight() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return vh - 2 * inset();
  }
  function paginated() {
    var de = document.documentElement, b = document.body;
    var cols = function (el) {
      if (!el) return false;
      var cs = window.getComputedStyle(el);
      var w = cs.columnWidth || cs.webkitColumnWidth, c = cs.columnCount || cs.webkitColumnCount;
      return (w && w !== "auto") || (c && c !== "auto" && c !== "1");
    };
    return cols(de) || cols(b) || de.scrollWidth > window.innerWidth + 20;
  }

  function parse(svg, cls) {
    var inner = svg.slice(svg.indexOf("<g transform"), svg.lastIndexOf("</svg>"));
    var doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '"><g class="' + cls + '" transform="scale(' + PT_MM + ')">' +
      inner + "</g></svg>", "image/svg+xml");
    var g = doc.documentElement.firstChild;
    if (!g || g.nodeName !== "g") throw new Error("garden: parse");
    return document.importNode(g, true);
  }
  function swap(el, g, cls) {
    var old = el.querySelector("." + cls), img = el.querySelector("image");
    el.insertBefore(g, el.firstChild);
    if (old) el.removeChild(old);
    if (img) img.style.display = "none";
  }
  function restore(el, cls) {
    var old = el.querySelector("." + cls), img = el.querySelector("image");
    if (old) el.removeChild(old);
    if (img) img.style.display = "";
  }
  function bboxView(el, W, H, pad) {
    var b = null;
    try { b = el.getBBox(); } catch (e) { b = null; }
    var x0 = -10, y0 = -10, x1 = W + 10, y1 = H + 10;
    if (b && b.width > 0) {
      x0 = Math.max(x0, b.x); y0 = Math.max(y0, b.y);
      x1 = Math.min(x1, b.x + b.width); y1 = Math.min(y1, b.y + b.height);
    }
    return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
  }

  // ---------------------------------------------------------- headpiece
  var heads = {};
  function head(el, i) {
    var box = el.parentNode.getBoundingClientRect();
    var w = box.width, ph = pageHeight();
    if (!(w > 80 && ph > 80)) return;
    var a = Math.max(1.1, Math.min(3.2, w / (BAND_SHARE * ph)));
    var W = Math.round(BAND_H * a);
    if (heads[i] === W) return;
    var g = parse(F.band(Object.assign(data(el, "data-florilegium-band"), { width: W, height: BAND_H, id: "flo-h" + i + "w" + W + "-" })), "flo-band");
    swap(el, g, "flo-band");
    var vb = bboxView(el, W, BAND_H, 1);
    el.setAttribute("viewBox", vb.map(function (v) { return v.toFixed(2); }).join(" "));
    el.style.width = "100%";
    el.style.height = Math.round(w * vb[3] / vb[2]) + "px";
    el.setAttribute("data-florilegium-sheet", W + "x" + BAND_H);
    heads[i] = W;
  }

  // ---------------------------------------------------------- chapter end
  var tails = {};
  function tail(el, i) {
    var box = el.parentNode;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var ph = pageHeight(), top = inset();
    // first the vignette, as without the script: the space left is measured from its place
    if (tails[i]) {
      restore(el, "flo-tail");
      el.setAttribute("viewBox", tails[i].vb);
      el.style.height = ""; el.style.width = "";
      box.classList.remove("ch-tail-garden");
      tails[i] = null;
    }
    if (!paginated()) return;
    var r = box.getBoundingClientRect();
    var rest = vh - top - r.top - 6;
    var k = BAND_H / (BAND_SHARE * ph);              // mm per pixel, as for the headpiece
    if (rest * k < TAIL_H + 4) return;
    // column width: from the tailpiece block stretched to the full column (in paginated
    // mode the body's rectangle spans all the columns at once)
    box.classList.add("ch-tail-garden");
    var colW = box.getBoundingClientRect().width;
    rest = vh - top - box.getBoundingClientRect().top - 6;
    var W = Math.round(colW * k), H = TAIL_H;
    if (rest * k < H + 4 || W < 40) { box.classList.remove("ch-tail-garden"); return; }
    var vbOld = el.getAttribute("viewBox");
    var g = parse(F.tailgarden(Object.assign(data(el, "data-florilegium-tail"), { width: W, height: H, id: "flo-t" + i + "s" + W + "x" + H + "-" })), "flo-tail");
    swap(el, g, "flo-tail");
    // fit to the drawing: the lifted mask lets leaves run past the sheet's edge
    var vb = bboxView(el, W, H, 1);
    el.setAttribute("viewBox", vb.map(function (v) { return v.toFixed(2); }).join(" "));
    el.setAttribute("preserveAspectRatio", "xMidYMin meet");
    el.style.width = "100%";
    el.style.height = Math.floor(Math.min(rest, colW * vb[3] / vb[2])) + "px";
    el.setAttribute("data-florilegium-sheet", W + "x" + H);
    tails[i] = { vb: vbOld };
  }

  function all() {
    var hs = document.querySelectorAll("svg[data-florilegium-band]");
    for (var i = 0; i < hs.length; i++) {
      try { head(hs[i], i); } catch (e) { if (window.console) console.log("florilegium: " + (e && e.message)); }
    }
    var ts = document.querySelectorAll("svg[data-florilegium-tail]");
    for (var j = 0; j < ts.length; j++) {
      try { tail(ts[j], j); } catch (e) { if (window.console) console.log("florilegium: " + (e && e.message)); }
    }
  }

  var tries = 0, timer = null;
  function start() {
    if (!document.querySelector("svg[data-florilegium-band], svg[data-florilegium-tail]")) return;
    if (!(pageHeight() > 80) && tries++ < 20) { setTimeout(start, 150); return; }
    all();
  }
  window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(all, 350); });
  if (document.readyState === "complete") setTimeout(start, 30);
  else window.addEventListener("load", function () { setTimeout(start, 30); });
})();
