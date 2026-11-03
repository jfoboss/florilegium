// index.js — the cosmos ornament, a theme of its own next to the flower garden.
// Star atlases, orbits, planets, zodiac constellations and flat astronomical
// signs instead of flowers. The flower engine (js/src) is not touched: this
// package borrows its drawing core, page layout and ornament sheets and grows
// its own motifs through them.
"use strict";
const P = require("../src/page.js");
const cosmicgrow = require("./cosmicgrow.js");
const cosmicflora = require("./cosmicflora.js");
const cosmos = require("./cosmos.js");

// A page of the cosmic garden: the sheet, margins, colors and SVG of the flower
// engine (js/src/page.js), but the growth is cosmicgrow's and the organs are
// cosmicflora's (planets and zodiac signs where the garden has flowers).
function page(o) {
  o = Object.assign({}, o, { grow: cosmicgrow });
  if (o.glow !== undefined) cosmicflora.set_glow(o.glow);   // a halo under the signs, for dark paper
  const r = P.page(o);
  r.stats.theme = "cosmos-flora";
  return r;
}

module.exports = {
  page,
  atlas: cosmos.page,                 // a star atlas page (armillary, zodiac, a special body)
  band: cosmos.band,
  tailgarden: cosmos.tailgarden,
  vignette: cosmos.vignette,
  tile: cosmos.tile,
  plan: cosmos.plan,                  // which special body a seed gets (ship, squid, planet, comet)
  version: 1,
};
