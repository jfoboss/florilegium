# florilegium in JavaScript — live part-title pages for ePub

A hand port of the grown composition from Lua to plain JavaScript (ES5 in the bundle, no
dependencies), made to put florilegium gardens into ePub books. Scope: theme `flora`, the
page without a header, no animation, no initials. The SVG it writes is **byte for byte** the
one `florilegium-svg.lua` writes for the same options. On top of the port, engine version 2
adds chapter ornaments made with the same engine (they have no Lua counterpart).

Why a port, when `web/` already runs the Lua in the browser through wasmoon: an ePub
can't load a WebAssembly runtime from a CDN, and most e-readers run only a small subset of
JS. The port is one self-contained file (`dist/florilegium-garden.js`, ~135 KB) that an
ePub ships next to its XHTML.

## How it is used in a book

A part-title page carries a static garden (an image inside an `<svg>` wrapper, grown on a
120 × 200 mm sheet) and the part's title. `src/shmuc.js` measures the reader's page, grows
the garden with the same seed on a sheet of the page's proportions, and swaps it in.
With scripts off, or on any error, the image stays: the page works without the script.

```html
<svg data-florilegium="7 1F3A93 C0392B autumn" viewBox="0 0 120 200" ...>
  <image href="garden-7.svg" .../>
  <text class="flo-label">Part II</text><line class="flo-rule"/><text class="flo-name">…</text>
</svg>
<script src="florilegium-garden.js"></script>
```

`data-florilegium` is `seed ink accent [season] [novisitors]`.

A chapter carries a headpiece above its title and a tailpiece after its last paragraph, each a
static image in an `<svg>` wrapper. `src/chapter.js` regrows the headpiece to the column width;
in paginated mode it puts a quiet garden band (60 mm, sparser and paler than the headpiece)
under the last paragraph if it fits on the page, otherwise the vignette stays. The headpiece
is an 80 mm band that takes about a third of the page, and the chapter-end garden uses the
same millimeters per pixel, so the flowers match. Here too the images are the fallback.

```html
<div class="ch-head"><svg data-florilegium-band="seed ink accent season [novisitors]" ...><image .../></svg></div>
<div class="ch-tail"><svg data-florilegium-tail="seed ink accent season [novisitors]" ...><image .../></svg></div>
```

## The engine

`FlorilegiumGarden` (`version: 2`); every function returns an SVG string, except `page`:

- `page(options)` — the options of `florilegium-svg.lua`'s `M.page`; returns `{ svg }`.
- `band({ seed, ink, accent, width, height = 80, season, visitors, id })` — the headpiece:
  the grown garden on a low, wide `width × height` mm sheet, a narrow column on the left
  and branches running right; the mask is lifted on all sides but the bottom.
- `tailgarden({ seed, ink, accent, width, height, density = 0.6, intensity = 0.35, ... })` —
  the chapter-end garden: the same, mirrored (column on the right), quieter by default.
- `vignette({ seed, ink, accent, intensity = 0.35, id })` — the tailpiece, 70 × 26 mm: a
  flower with curved stems both ways, buds at the ends, a copper sparkle.
- `tile({ seed, ink, accent, wash = 0.3, id })` — the initial tile, 20 × 20 mm: a double
  frame, a mottled wash and a vine; the middle stays free for the letter, which is live text.

`ink` and `accent` are hex colors (`2456C4`, `B4662F`); `id` prefixes the SVG ids, so that
several ornaments can share a page.

## Files

- `src/detmath.js`, `lua/detmath.lua` — the same math in both languages (sin, cos, atan,
  atan2, log, exp, pow after fdlibm). The built-in ones of browsers and glibc differ in the
  last bit, and the garden would grow differently.
- `src/fmt.js` — `%.Nf` as printf does it (exact halves to even).
- `src/ink.js`, `src/flora.js`, `src/grow.js` — ports of `florilegium-ink.lua`, `florilegium-flora.lua`, `florilegium-grow.lua`.
- `src/page.js` — TeX lengths, xcolor colors, the page layout, PDF operators to SVG
  (`florilegium-svg.lua`, `florilegium.lua`).
- `src/ornaments.js` — the chapter ornaments: `band`, `tailgarden`, `vignette`, `tile`.
- `src/shmuc.js`, `src/chapter.js` — the part-title and chapter scripts described above.
- `tools/bundle.js` — everything in one file, `dist/florilegium-garden.js`: the modules,
  the `FlorilegiumGarden` object, then `shmuc.js` and `chapter.js`.
- `tools/rewrite_pow.py` — rewrites `a ^ b` in Lua to `__pow(a, b)`, so the reference can
  use detmath's pow (Lua's `^` on numbers can't be overridden).
- `lua/ref_page.lua` — the reference page: the repo's Lua with detmath swapped in.

## Cross-checks

The tests rebuild the reference from the repo's own `*.lua` on every run (through
`rewrite_pow.py`, into a temp dir), so they always check the port against the current Lua.
They need `node`, `python3` and `texlua` (or any Lua 5.4: `LUA=lua5.4`).

    node test/detmath_cross.js   # ~200 000 inputs, JS and Lua agree in every bit
    node test/fmt_cross.js       # 300 019 numbers
    node test/ink_cross.js       # 423 lines
    node test/flora_cross.js     # 186 cases, every primitive
    node test/page_cross.js      # 96 pages: formats, mirror, seasons, density — byte for byte
    node test/page_cross.js quick
    node test/ornaments_smoke.js # the ornaments: well-formed SVG, deterministic (no Lua side)

The reference with detmath grows the same garden as the original florilegium (glibc math)
on seeds 1 and 8.

**Not kept in sync automatically**, like `postscript/`: a change to a primitive or to
`florilegium-grow.lua` has to be made here too. `page_cross.js` says when it is needed.

Then rebuild the bundle:

    node tools/bundle.js
