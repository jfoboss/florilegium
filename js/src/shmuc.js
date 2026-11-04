// shmuc.js — the live part-title page: the act's garden regrows to fit the e-reader page.
// Copyright (c) 2026 Kevin Raymond; JavaScript port (c) 2026 jfoboss. MIT License: see LICENSE.
//
// The ePub page carries a static garden (an image in an SVG wrapper) and the act title.
// The script measures the page, grows a garden with the same seed on a sheet of its
// proportions and puts it in place of the image. If scripts are off or something
// breaks, the image stays: the page works fully without the script.
//
// Sheet: height is always 200 mm, width follows the page proportions. At 120:200
// this is exactly the sheet the static image was taken from, and the garden is the same.
// Margins are fractions of the width, as on the static sheet (36/120 left, 12/120 right).
(function () {
  "use strict";
  var F = window.FlorilegiumGarden;
  if (!F || !window.DOMParser || !document.querySelector) return;
  var NS = "http://www.w3.org/2000/svg";
  var PT_MM = 25.4 / 72;
  var H = 200, TOP = 36, BOTTOM = 12, TEXTEND = 50;
  var LABEL_Y = TOP + 22, RULE_Y = TOP + 27.5, NAME_Y = TOP + 36;   // as on the static sheet

  function sheet(w, h) {
    var a = Math.max(0.4, Math.min(1.6, w / h));
    var W = Math.round(H * a);
    var left = Math.round(W * 0.3), right = Math.round(W * 0.1);
    return { W: W, left: left, right: right, textleft: left, textright: W - right };
  }

  // garden mask: outer sides are dropped so leaves at the sheet edge are not cut
  // (like unclip in ebook-build/scripts/make_gardens.py); inner ones (the title zone border) stay
  function unclip(svg, s) {
    var Hpt = H / PT_MM, far = 120, edge = (s.textright - 10) / PT_MM;
    var re = /(<clipPath id="[^"]+"><path d=")([^"]+)("\/><\/clipPath>)/;
    var m = re.exec(svg);
    if (!m) return svg;
    var rects = [], r, rr = /M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)Z/g;
    while ((r = rr.exec(m[2]))) {
      var x1 = Math.min(+r[1], +r[3]), x2 = Math.max(+r[1], +r[3]);
      var y1 = Math.min(+r[2], +r[6]), y2 = Math.max(+r[2], +r[6]);
      if (x1 < 8) x1 -= far;
      if (y1 < 8) y1 -= far;
      if (y2 > Hpt - 8) y2 += far;
      if (x2 > edge) x2 += far;
      rects.push("M" + x1 + " " + y1 + "L" + x2 + " " + y1 + "L" + x2 + " " + y2 + "L" + x1 + " " + y2 + "Z");
    }
    return svg.replace(m[0], m[1] + rects.join("") + m[3]);
  }

  function grow(el, s) {
    var d = el.getAttribute("data-florilegium").split(" ");   // seed ink accent [season] [novisitors]
    var o = { seed: +d[0], ink: d[1], accent: d[2], paper: s.W + "x" + H,
      left: s.left + "mm", right: s.right + "mm", top: TOP + "mm", bottom: BOTTOM + "mm",
      headsep: "0mm", headheight: "0pt", textend: TEXTEND + "mm", id: "flo" + d[0] + "w" + s.W + "-" };
    if (d[3] && d[3] !== "summer") o.season = d[3];
    if (d[4] === "novisitors") o.visitors = false;
    var svg = unclip(F.page(o).svg, s);
    var inner = svg.slice(svg.indexOf("<g transform"), svg.lastIndexOf("</svg>"));
    var doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '"><g class="flo-garden" transform="scale(' + PT_MM + ')">' +
      inner + "</g></svg>", "image/svg+xml");
    var g = doc.documentElement.firstChild;
    if (!g || g.nodeName !== "g") throw new Error("garden: parse");
    return document.importNode(g, true);
  }

  function place(el, s) {
    var tw = s.textright - s.textleft;
    var x = s.textleft + tw * 0.403;
    var half = Math.min(x - s.textleft, s.textright - x) - 1;
    var label = el.querySelector(".flo-label"), rule = el.querySelector(".flo-rule"), name = el.querySelector(".flo-name");
    var fit = function (t, size) {
      if (!t) return;
      t.setAttribute("x", x);
      t.setAttribute("font-size", size);
      try {
        var len = t.getComputedTextLength();
        if (len > 2 * half) t.setAttribute("font-size", (size * 2 * half / len).toFixed(2));
      } catch (e) { /* cannot measure: leave as is */ }
    };
    if (label) { label.setAttribute("y", LABEL_Y); fit(label, 4.8); }
    if (rule) { rule.setAttribute("x1", x - 6); rule.setAttribute("x2", x + 6); rule.setAttribute("y1", RULE_Y); rule.setAttribute("y2", RULE_Y); }
    if (name) { name.setAttribute("y", NAME_Y); fit(name, 4.0); }
  }

  function frame(el, s) {
    var b = null;
    try { b = el.getBBox(); } catch (e) { b = null; }
    var x0 = -15, y0 = -15, x1 = s.W + 15, y1 = H + 15;      // at most 15 mm past the sheet
    if (b && b.width > 0) {
      x0 = Math.max(x0, b.x); y0 = Math.max(y0, b.y);
      x1 = Math.min(x1, b.x + b.width); y1 = Math.min(y1, b.y + b.height);
    }
    var p = 1.5;
    el.setAttribute("viewBox", [x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p].map(function (v) { return v.toFixed(2); }).join(" "));
  }

  // E-reader page: width is the column holding the garden (in a spread that is
  // one page, not the whole window), height is the window minus top and bottom margins.
  function measure(el) {
    var box = el.parentNode && el.parentNode.getBoundingClientRect ? el.parentNode.getBoundingClientRect() : null;
    var w = box && box.width > 80 ? box.width : document.documentElement.clientWidth || window.innerWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var top = box ? Math.max(0, Math.min(box.top + (window.pageYOffset || 0), vh / 4)) : 0;
    var h = vh - 2 * top;
    return { w: w, h: h };
  }

  var done = {};
  function render(el, i) {
    var m = measure(el);
    if (!(m.w > 80 && m.h > 80)) return false;
    var s = sheet(m.w, m.h);
    if (done[i] !== s.W) {
      var g = grow(el, s);
      var old = el.querySelector(".flo-garden"), img = el.querySelector("image");
      el.insertBefore(g, el.firstChild);
      if (old) el.removeChild(old);
      if (img) img.parentNode.removeChild(img);
      place(el, s);
      frame(el, s);
      el.setAttribute("data-florilegium-sheet", s.W + "x" + H);
      done[i] = s.W;
    }
    // the sheet fits the page whole (meet) rather than stretching to the width
    el.style.width = "100%";
    el.style.height = Math.floor(m.h) + "px";
    return true;
  }

  function all() {
    var els = document.querySelectorAll("svg[data-florilegium]");
    for (var i = 0; i < els.length; i++) {
      try { render(els[i], i); }
      catch (e) { if (window.console) console.log("florilegium: " + (e && e.message)); }
    }
  }

  var tries = 0, timer = null;
  function start() {
    // the e-reader may show the page before it has a size
    var el = document.querySelector("svg[data-florilegium]");
    if (!el) return;
    var m = measure(el);
    if (!(m.w > 80 && m.h > 80) && tries++ < 20) {
      setTimeout(start, 150);
      return;
    }
    all();
  }
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(all, 350);
  });
  if (document.readyState === "complete") setTimeout(start, 30);
  else window.addEventListener("load", function () { setTimeout(start, 30); });
})();
