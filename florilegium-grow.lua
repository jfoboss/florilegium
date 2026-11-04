-- florilegium-grow.lua -- the grown composition of florilegium (LuaLaTeX only).
-- Copyright (c) 2026 Kevin Raymond. MIT License: see LICENSE or florilegium.sty.
--
-- A plant, not a packing. Everything grows from one root in the bottom-left
-- corner of the page:
--   1. stems: two or three long stems sway up the margin column (their x is a
--      smooth noise of their height, so they cross now and then); the first
--      ends in the largest flower at the top. A footer stem runs from the root
--      along the bottom of the page. On the last page, extra stems wave into
--      the space under the text.
--   2. leaves are hung at the nodes of the stems, alternating sides.
--   3. a greedy loop in the spirit of Wong, Zongker & Salesin, "Computer-
--      Generated Floral Ornament" (SIGGRAPH 1998): take the largest free disc
--      within reach of a stem, choose a motif that fits it, and grow a branch
--      to it from the nearest stem point. The branch leaves its parent along
--      the parent's direction and arrives along the motif's axis, so every
--      flower can be traced back to the root. Branches become stems for later
--      branches. Repeat until only small holes are left.
--   4. small holes get florets, buds and leaflets on short stalks; a few
--      copper accents go along the outer edge; pale ghost flowers sit behind.
-- Proxies (discs) may overlap a little, so leaves tuck under flowers.
-- Without a theme, the page grows species (florilegium-species.lua): four plants of the
-- document's pool of eight, the hero, a second showy plant and the monocot on the three
-- main stems and a spray on the footer; every motif belongs to the plant whose stem it
-- grows from, its visitors come with it, and florilegium-native.lua draws its organs. A
-- theme grows v1.3's motifs instead (the `else` of every `if comm`).
-- Everything is deterministic for a given seed.

local ink = require("florilegium-ink")
local flora = require("florilegium-flora")
local M = {}
M.version = "2.0.0"                 -- the release; florilegium.lua checks that every file has the same
-- the primitives of the current theme: flora itself, or a theme's own in front
-- of it (see M.theme); every primitive in this file is called through F
local F = flora

local sqrt, cos, sin, atan, pi, floor, max, min, abs = math.sqrt, math.cos, math.sin, math.atan, math.pi, math.floor, math.max, math.min, math.abs
local rad = pi / 180
local tone = ink.tone
local function dist(ax, ay, bx, by) local dx, dy = ax - bx, ay - by return sqrt(dx * dx + dy * dy) end
local function lerp(a, b, t) return a + (b - a) * t end
local function smoothstep(a, b, x) local t = math.min(1, math.max(0, (x - a) / (b - a))) return t * t * (3 - 2 * t) end
local function norm(x, y) local L = sqrt(x * x + y * y) if L < 1e-9 then return 0, 1 end return x / L, y / L end
local function deg(x, y) return atan(y, x) / rad end

-- layers, back to front (the overlay only in the growth animation)
local L_GHOST, L_STEM, L_LEAF, L_AIRY, L_BLOOM, L_ACCENT, L_OVERLAY = 1, 2, 3, 4, 5, 6, 7

local GRID     = 0.2    -- candidate spacing (cm)
local REACH    = 3.0    -- a motif must be within this distance of a stem
local SMALLEST = 0.36   -- the branch loop stops below this free radius
local FILLMIN  = 0.17   -- the filler stops below this
local PROFILE  = 0.72   -- a top flower seen in profile (a bell, a tube) is drawn this much smaller

-- the growth animation: a stem is recorded as prefixes GROWSTEP cm apart, a
-- motif at the scales in BLOOM before its full size (eased: quick, then settling)
local GROWSTEP = 0.3
local BLOOM    = { 0.25, 0.45, 0.62, 0.76, 0.87, 0.95 }
local FLYSTEPS = 14     -- positions of a visitor flying in

-- ---------------------------------------------------------------- motifs
-- r(s): proxy radius; off(s): distance from the disc center back to the
-- primitive's origin, along the motif's axis; upright: the axis leans upward
-- (sprays reach for the light); draw(rng, s, p): the primitive in a frame whose
-- +y is the axis (p: progress of its flight in the animation, nil on the page).
-- Visitors fly: no branch, and only on pages that the visitor stream allows.
-- spring/summer/autumn multiply w as the garden ages (default 1; see `season`).
local motifs = {
  { name = "flower",  w = 3,   smin = 0.75, smax = 1.3, max = 3, hard = true, layer = L_BLOOM, spring = 0.12, autumn = 0.45,
    r = function(s) return 1.0 * s end, off = function(s) return 0 end,
    draw = function(rng, s) F.flower(rng, s) end },
  { name = "lily",    w = 2,   smin = 0.8,  smax = 1.25, max = 2, hard = true, layer = L_BLOOM, upright = 0.4, spring = 0.1, autumn = 0.4,
    r = function(s) return 0.9 * s end, off = function(s) return 0.15 * s end,
    draw = function(rng, s) F.lily(rng, s) end },
  { name = "blossoms", w = 3,  smin = 0.55, smax = 0.85, max = 5, layer = L_BLOOM, upright = 0.5, spring = 0.5, autumn = 0.5,
    r = function(s) return s end, off = function(s) return 0.6 * s end,
    draw = function(rng, s)
      local n = rng.int(2, 4)
      for k = 1, n do
        local a = (k - (n + 1) / 2) * 38 + rng.sym(10)
        local d = s * rng.range(0.45, 0.8) * (k == 1 and 1 or rng.range(0.85, 1.1))
        local x, y = d * sin(a * rad), d * cos(a * rad)
        ink.moveto(0, 0) ink.curveto(0, d * 0.4, x * 0.6, y * 0.7, x, y) ink.stroke(tone(0.1), 0.35)
        ink.push() ink.translate(x, y) F.blossom(rng, s * rng.range(0.38, 0.5)) ink.pop()
      end
      if rng.chance(0.6) then ink.push() ink.rotate(rng.sym(50)) ink.scale(0.5 * s) F.bud(rng, 1) ink.pop() end
    end },
  { name = "cyme",    w = 3,   smin = 1.0,  smax = 2.4, max = 6, layer = L_AIRY, upright = 0.6, spring = 1.3, autumn = 0.7,
    r = function(s) return 0.45 * s end, off = function(s) return 0.5 * s end,
    draw = function(rng, s) F.cyme(rng, s) end },
  { name = "sprig",   w = 2,   smin = 1.2,  smax = 2.8, max = 4, layer = L_AIRY, upright = 0.8, spring = 1.2,
    r = function(s) return 0.42 * s end, off = function(s) return 0.5 * s end,
    draw = function(rng, s) F.sprig(rng, s) end },
  { name = "umbel",   w = 1.5, smin = 0.8,  smax = 1.5, max = 3, hard = true, layer = L_AIRY, upright = 1.0, spring = 0.8, autumn = 0.8,
    r = function(s) return 0.75 * s end, off = function(s) return 0.6 * s end,
    draw = function(rng, s) F.umbel(rng, s) end },
  { name = "leaf",    w = 2,   smin = 0.9,  smax = 2.0, max = 8, layer = L_LEAF, upright = 0.2, spring = 1.3, autumn = 1.2,
    r = function(s) return 0.32 * s end, off = function(s) return 0.5 * s end,
    draw = function(rng, s) ink.scale(s) F.leaf(rng, { w = rng.range(0.22, 0.3), depth = rng.chance(0.6) and rng.range(0.4, 0.8) or 0 }) end },
  { name = "bud",     w = 1,   smin = 0.45, smax = 0.75, max = 5, layer = L_BLOOM, upright = 0.5, spring = 3.5, autumn = 0.3,
    r = function(s) return 0.45 * s end, off = function(s) return 0.5 * s end,
    draw = function(rng, s) F.bud(rng, s) end },
  { name = "bells",   w = 0.7, smin = 0.6,  smax = 0.95, max = 1, hard = true, layer = L_BLOOM, hang = true, spring = 0.5, autumn = 0.6,
    r = function(s) return 0.62 * s end, off = function(s) return 0 end,
    draw = function(rng, s)
      F.bell(rng, s)
      ink.moveto(0, 0) ink.curveto(0.15 * s, 0.25 * s, 0.4 * s, 0.25 * s, 0.5 * s, 0.1 * s) ink.stroke(tone(0.1), 0.35)
      ink.push() ink.translate(0.5 * s, 0.1 * s) F.bell(rng, 0.75 * s) ink.pop()
    end },
  { name = "tendril", w = 0.6, smin = 0.3,  smax = 0.5, max = 4, layer = L_AIRY, spring = 2, autumn = 1.3,
    r = function(s) return 1.0 * s end, off = function(s) return 1.0 * s end,
    draw = function(rng, s) ink.rotate(90) F.tendril(rng, s) end },
  { name = "budding", w = 3,   smin = 0.55, smax = 0.9, max = 6, layer = L_BLOOM, upright = 0.6,
    spring = 1, summer = 0, autumn = 0,
    r = function(s) return 0.9 * s end, off = function(s) return 0.6 * s end,
    draw = function(rng, s)                    -- a spray of closed buds on stalks
      local n = rng.int(2, 4)
      for k = 1, n do
        local a = (k - (n + 1) / 2) * 34 + rng.sym(10)
        local d = s * rng.range(0.5, 0.85)
        local x, y = d * sin(a * rad), d * cos(a * rad)
        ink.moveto(0, 0) ink.curveto(0, d * 0.4, x * 0.6, y * 0.7, x, y) ink.stroke(tone(0.1), 0.35)
        ink.push() ink.translate(x, y) ink.rotate(-a * 0.6) F.bud(rng, s * rng.range(0.45, 0.6)) ink.pop()
      end
    end },
  { name = "seedhead", w = 2,  smin = 0.45, smax = 0.75, max = 3, hard = true, layer = L_AIRY, upright = 0.6,
    spring = 0, summer = 0, autumn = 1,
    r = function(s) return 1.05 * s end, off = function(s) return 0 end,
    draw = function(rng, s) F.seedhead(rng, s) end },
  { name = "butterfly", w = 0.8, smin = 1.1, smax = 1.5, max = 2, hard = true, layer = L_ACCENT, fly = true,
    r = function(s) return 0.5 * s end, off = function(s) return 0 end,
    draw = function(rng, s, p) F.butterfly(rng, s, p and { open = 0.3 + 0.7 * abs(cos(p * 5 * pi)) }) end },
  { name = "bee",     w = 0.8, smin = 0.7,  smax = 0.85, max = 2, hard = true, layer = L_ACCENT, fly = true,
    r = function(s) return 0.6 * s end, off = function(s) return 0 end,
    draw = function(rng, s, p) F.bee(rng, s, { trail = p == nil }) end },
}

M.layers = { ghost = L_GHOST, stem = L_STEM, leaf = L_LEAF, airy = L_AIRY, bloom = L_BLOOM, accent = L_ACCENT }

-- ---------------------------------------------------------------- themes
-- A theme (florilegium-theme-<name>.lua) replaces primitives by name and may reweight or
-- add motif rows. It returns { flora = { name = fn, ... }, motifs = fn(rows, F) }:
-- rows are copies of the rows above (keep their names; w = 0 retires one), F
-- the theme's primitives with flora's behind them. Everything here draws
-- through F, so the theme's `flower` grows wherever a flower would. A theme
-- that is not a plant at all brings its own composition, page = fn(g, grow),
-- which M.page hands the page to. No theme (nil, "" or "flora") is the garden
-- as it always was.
local base, themes, composition = motifs, {}, nil

-- A theme is the module florilegium-theme-<name>. A theme written before the modules
-- had the prefix, theme-<name>.lua, still loads, with a warning. Only a missing file
-- falls back to the old name; an error inside a theme is reported as it is.
local function load_theme(name)
  local new, old = "florilegium-theme-" .. name, "theme-" .. name
  local function missing(err, mod) return tostring(err):find("module '" .. mod .. "' not found", 1, true) end
  local ok, t = pcall(require, new)
  if ok then return t end
  if not missing(t, new) then error("florilegium: theme '" .. name .. "': " .. tostring(t), 0) end
  local ok_old, t_old = pcall(require, old)
  if ok_old then
    if texio then
      texio.write_nl("florilegium warning: theme '" .. name .. "' came from " .. old .. ".lua; rename it "
        .. new .. ".lua, the old name will stop working in a later version")
    end
    return t_old
  end
  if not missing(t_old, old) then error("florilegium: theme '" .. name .. "': " .. tostring(t_old), 0) end
  error("florilegium: no theme '" .. name .. "' (" .. new .. ".lua): " .. tostring(t), 0)
end

function M.theme(name)
  if name == nil or name == "" or name == "flora" then
    F, motifs, composition = flora, base, nil
  else
    local th = themes[name]
    if not th then
      local t = load_theme(name)
      local tf = setmetatable({}, { __index = flora })
      for k, fn in pairs(t.flora or {}) do tf[k] = fn end
      local rows = {}
      for i, m in ipairs(base) do rows[i] = {} for k, v in pairs(m) do rows[i][k] = v end end
      th = { flora = tf, motifs = t.motifs and t.motifs(rows, tf) or rows, page = t.page }
      themes[name] = th
    end
    F, motifs, composition = th.flora, th.motifs, th.page
  end
  M.flora, M.motifs = F, {}
  for _, m in ipairs(motifs) do M.motifs[m.name] = m end
  return F, composition
end
M.theme(nil)

-- ---------------------------------------------------------------- region
-- rects = { {x0,y0,x1,y1}, ... }, a union; shared edges count as open
local function inside(r, x, y) return x > r[1] and x < r[3] and y > r[2] and y < r[4] end
-- the distance from (x, y) to the parts of r's edge (vertical at u = c when `vert`, from a
-- to b) that no other rect continues across (they are open there): with rects.corners
-- (species pages) the corner where an opening ends counts too, as where the text block
-- juts into the free region at the end of the text or above the footer band; v1.3's pages
-- (themes) look only straight across, so a disc there can reach past such a corner
local function closed_part(rects, r, x, y, vert, c, out, a, b)
  local cuts = {}
  for _, o in ipairs(rects) do
    if o ~= r then
      if vert and out > o[1] and out < o[3] then cuts[#cuts + 1] = { max(a, o[2]), min(b, o[4]) }
      elseif not vert and out > o[2] and out < o[4] then cuts[#cuts + 1] = { max(a, o[1]), min(b, o[3]) } end
    end
  end
  table.sort(cuts, function(p, q) return p[1] < q[1] end)
  local d, t = math.huge, a
  local function seg(s0, s1)
    if s1 <= s0 then return end
    local u = vert and y or x
    local w = min(max(u, s0), s1)
    local dx, dy = vert and (x - c) or (x - w), vert and (y - w) or (y - c)
    local e = sqrt(dx * dx + dy * dy)
    if e < d then d = e end
  end
  for _, k in ipairs(cuts) do
    if k[2] > k[1] then seg(t, k[1]) if k[2] > t then t = k[2] end end
  end
  seg(t, b)
  return d
end
local function border(rects, x, y)
  local best = -1
  for _, r in ipairs(rects) do
    if inside(r, x, y) then
      local d, near = math.huge, math.huge
      local edges = { { x - r[1], r[1] - 0.05, y }, { r[3] - x, r[3] + 0.05, y }, { y - r[2], x, r[2] - 0.05 }, { r[4] - y, x, r[4] + 0.05 } }
      for i, e in ipairs(edges) do
        local open = false
        for _, o in ipairs(rects) do if o ~= r and inside(o, e[2], e[3]) then open = true end end
        if not open and e[1] < d then d = e[1] end
        if open and rects.corners then
          local v = i <= 2
          local c = ({ r[1], r[3], r[2], r[4] })[i]
          local cd = closed_part(rects, r, x, y, v, c, v and e[2] or e[3], v and r[2] or r[1], v and r[4] or r[3])
          if cd < d then d = cd end
        end
        if e[1] < near then near = e[1] end
      end
      -- every edge open (the point's rect lies wholly among others): its own nearest
      -- edge, or the free radius would be infinite and the next disc would visit every
      -- cell there could be (no region of v1.3's makes such a point)
      if d == math.huge then d = near end
      if d > best then best = d end
    end
  end
  return best
end

-- the regions a garden may use, in page cm: the margin column, the footer band
-- (its length drawn from `layout`) and, on the last page, the space under the text.
-- Species (without a theme): the last page's garden reaches down to the page number's
-- line, 0.55 cm above its baseline, and the footer band runs the full width under it,
-- so only the line the number is set on stays clear (about a centimeter, wherever the
-- class puts the number); v1.3's pages stop 0.6 cm above the foot of the text block.
function M.regions(g, layout)
  local col = { 0.3, 0.45, g.colright, g.ph - 0.5 }
  local fx1 = g.textleft + (g.textright - g.textleft) * layout.range(0.42, 0.52)
  local foot = { g.colright - 0.01, 0.4, fx1, min(1.75, g.footy - 0.45) }
  local rects = { col, foot }
  local low = not g.theme or g.theme == "flora"        -- the species garden
  local bottom = low and min(g.ybot + 0.6, g.footy + 0.55) or g.ybot + 0.6
  local spill
  if g.spill == 1 and (g.spilly - 0.8) - bottom > 2.5 then
    spill = { g.colright - 0.01, bottom, g.textright - 0.2, g.spilly - 0.8 }
    rects[#rects + 1] = spill
    if low then rects[#rects + 1] = { fx1 - 0.01, 0.4, g.textright - 0.2, foot[4] } end
  end
  rects.corners = low or nil
  return rects, col, foot, spill, fx1
end

-- the free space: points on a GRID lattice over the regions (x, y), and for each
-- the radius of the largest disc there that stays inside them and clear of every
-- proxy so far (free). disc(x, y, r, k) adds a proxy; free_at(x, y) reads it back.
-- The lattice is global, so a disc only visits the cells near it.
function M.field(rects)
  local gx, gy, free, lat = {}, {}, {}, {}
  local function key(ix, iy) return ix * 100000 + iy end
  for _, r in ipairs(rects) do
    for ix = floor(r[1] / GRID), floor(r[3] / GRID) do
      for iy = floor(r[2] / GRID), floor(r[4] / GRID) do
        local x, y = (ix + 0.5) * GRID, (iy + 0.5) * GRID
        local k = key(ix, iy)
        if not lat[k] then
          local b = border(rects, x, y)
          if b > 0 then
            local i = #gx + 1
            gx[i], gy[i], free[i] = x, y, b
            lat[k] = i
          end
        end
      end
    end
  end
  local maxfree = 0
  for i = 1, #free do if free[i] > maxfree then maxfree = free[i] end end
  local f = { x = gx, y = gy, free = free }
  function f.each_near(x, y, R, fn)
    for ix = floor((x - R) / GRID), floor((x + R) / GRID) do
      for iy = floor((y - R) / GRID), floor((y + R) / GRID) do
        local i = lat[key(ix, iy)]
        if i then fn(i) end
      end
    end
  end
  -- a proxy disc: cells count it at k of its radius (k < 1 lets things overlap)
  function f.disc(x, y, r, k)
    k = k or 0.85
    f.each_near(x, y, r * k + maxfree, function(i)
      local d = dist(gx[i], gy[i], x, y) - k * r
      if d < free[i] then free[i] = d end
    end)
  end
  function f.free_at(x, y)
    local i = lat[key(floor(x / GRID), floor(y / GRID))]
    return i and free[i] or -1
  end
  return f
end

-- ---------------------------------------------------------------- animation timing
-- Every step of the growth is an event: a stem that grows at a constant
-- speed, or a motif that opens. An event either belongs to a phase (stems,
-- ghost, branch, fill, accent, tail) or starts at a fraction `at` of its
-- parent's growth, e.g. a leaf when the stem tip passes its node. Times are
-- seconds of a nominal timeline; florilegium.lua spreads the frames over it.
local T_START, T_STEMS = 0.4, 3.6           -- an empty margin, then the tallest stem takes 3.6 s
local T_BRANCHES, T_EASE = 6.0, 0.55        -- branch i of n starts at (i/n)^0.55: big holes slowly
local T_FILL, T_ACCENT = 1.2, 0.5

local function schedule(events)
  local Lmax, n = 0, { branch = 0, fill = 0, accent = 0, fall = 0 }
  for _, e in ipairs(events) do
    if e.phase == "stems" then Lmax = max(Lmax, e.len or 0) end
    if n[e.phase] then n[e.phase] = n[e.phase] + 1 end
  end
  local speed = Lmax / T_STEMS
  local function start(i, N) return T_BRANCHES * ((i - 1) / max(1, N)) ^ T_EASE end
  for _, e in ipairs(events) do
    if e.span then e.dur = e.span
    elseif e.kind == "stem" then e.dur = (e.len or 0) / speed
    elseif e.kind == "bloom" then e.dur = e.root.phase == "ghost" and 1.2 or 0.2 + 0.25 * min(1, e.size or 0.5)
    elseif e.kind == "overlay" then
      -- the dashed disc shows a little before its branch starts, longer while the loop is slow
      local i = e.parent.i
      e.lead = max(0.08, min(0.4, 1.5 * (start(i + 1, n.branch) - start(i, n.branch))))
    end
    e.dur = max(e.dur or 0, 1e-3)
  end
  -- resolve start times in creation order (a parent is always created before its children)
  local function resolve(root_t0)
    local last = 0
    for _, e in ipairs(events) do
      if not e.t0 then
        local p = e.parent
        if not p then e.t0 = root_t0(e)
        elseif p.t0 and e.kind == "overlay" then e.t0, e.dur = p.t0 - e.lead, e.lead + p.dur
        elseif p.t0 then e.t0 = p.t0 + (e.at or 0) * p.dur end
      end
      if e.t0 and not e.till_end then last = max(last, e.t0 + e.dur) end
    end
    return last
  end
  local t1 = resolve(function(e)
    if e.phase == "stems" then return T_START + (e.off or 0) end
    if e.phase == "ghost" then return T_START + 0.8 * e.i end
  end)
  local t2 = resolve(function(e)
    if e.phase == "marks" then return t1 + 0.1 + 0.3 * (e.i - 1) end
    if e.phase == "branch" then return t1 + 0.2 + start(e.i, n.branch) end
  end)
  local t3 = resolve(function(e)
    if e.phase == "fall" then return t2 - 0.4 + T_FILL * (e.i - 1) / max(1, n.fall) end
    if e.phase == "fill" then return t2 + 0.1 + T_FILL * (e.i - 1) / max(1, n.fill) end
  end)
  local t4 = resolve(function(e)
    if e.phase == "tail" then return t3 end
    if e.phase == "accent" then return t3 + T_ACCENT * (e.i - 1) / max(1, n.accent) end
  end)
  for _, e in ipairs(events) do
    assert(e.t0, "florilegium: an animation event without a start")
    if e.till_end then e.dur = max(0.5, t4 - e.t0) end       -- e.g. the snail crawls until the end
  end
  return t4
end

-- the part [0,t] of a cubic Bézier, by de Casteljau
local function bezier_head(x0, y0, x1, y1, x2, y2, x3, y3, t)
  local ax, ay = lerp(x0, x1, t), lerp(y0, y1, t)
  local bx, by = lerp(x1, x2, t), lerp(y1, y2, t)
  local cx, cy = lerp(x2, x3, t), lerp(y2, y3, t)
  local dx, dy = lerp(ax, bx, t), lerp(ay, by, t)
  local ex, ey = lerp(bx, cx, t), lerp(by, cy, t)
  return ax, ay, dx, dy, lerp(dx, ex, t), lerp(dy, ey, t)
end

-- ---------------------------------------------------------------- species
-- The species garden (every grown page without a theme; a theme grows v1.3's garden in
-- its own primitives): each main stem is one plant of
-- florilegium-species.lua, 1 the hero, 2 a second showy plant, 3 the monocot, and the
-- footer a spray, all four from the document's pool. Every stem point knows its plant, so a branch
-- carries its own plant's flowers, buds, leaves and tendrils, which florilegium-native.lua
-- draws. The rows below stand in for the motifs; they are made per page and never
-- touch the motif table. The modules load with the first species page.
local SPC, ORG
-- a pgf seed for an organ, from an ink rng (inside a closure: the animation replays it)
local function pgfseed(r) return 1 + floor(r.u() * 2147483645) end
-- the rows of plant i (species sp): its inflorescence, a smaller later one, buds on
-- stalks, a leaf, tendrils if it climbs; sea is the organs' season (0.3 spring, 0.75
-- summer, 1.25 autumn). A row's draw(rng, s, p, h) takes the height h (0..1) on its plant.
-- The page's plants share v1.3's allowance: a row's `max` caps its group (all the
-- plants' leaves together, as v1.3 has one leaf row), `limit` the row itself.
M.GROUPS = { unit = 9, bloom = 3, spray = 8, budding = 6, leaf = 8, tendril = 4 }
-- how much longer than v1.3's a species' leaf is drawn, so that it carries about as much
-- ink: a compound leaf a third longer, so that its leaflets read as leaves; a narrow blade
-- longer as it is narrower (v1.3's leaf is about 2.2 times as long as it is wide), up to
-- 1.45 times. The TikZ library's \flo@leafcof computes the same for its plants
local function leafc_of(sp)
  if sp.compound ~= "simple" then return 1.35 end
  return min(1.45, max(1, sqrt(sp.leafaspect / 2.2)))
end
local function species_rows(sp, i, sea)
  local O = ORG
  local _, r1, kind = O.unitdisc(sp, 1)       -- the disc grows linearly with the scale k
  local fd1 = min(2.8, 0.7 + 0.032 * sp.size) -- a flower's diameter at k = 1
  local airy = kind == "umbel" or kind == "raceme"
  local up = ({ solitary = 0.3, blossoms = 0.5, umbel = 1.0, raceme = 0.6, head = 0.5, catkin = 0.4 })[kind]
  local leafc = leafc_of(sp)
  -- Copper is v1.3's sparing accent: a red or orange plant, painted in it, flowers once
  -- a page in each way (a hole near it may stay empty)
  local cu = (sp.color == "red" or sp.color == "orange") and 1 or nil
  local function row(name, t)
    t.name, t.kind, t.group, t.sp, t.max = name .. ":" .. i, name, "g:" .. name, sp, M.GROUPS[name]
    return t
  end
  -- an airy motif (rays, a raceme's axis, buds on stalks, a tendril) claims less room
  -- than its extent, as v1.3's sprays do, so its neighbors grow into its gaps
  local claim = airy and 0.65 or 1
  local function unit(name, w, kmin, kmax, later, hard)
    return row(name, { w = w, smin = kmin, smax = kmax, hard = hard, limit = cu, claim = claim,
      layer = airy and L_AIRY or L_BLOOM, upright = up, spring = 0.6, autumn = 0.8, bloom = not airy,
      r = function(k) return r1 * k end, off = function(k) return (O.unitdisc(sp, k)) end,
      draw = function(rng, k, _, h)
        O.draw("unit", sp, pgfseed(rng), { k = k, season = sea, late = O.lateness(sp, h or 0.5) + later })
      end })
  end
  -- as in v1.3, the statement (the full inflorescence) has a hard cap, so that it
  -- dominates where it stands; it is as large as v1.3's flowers (a radius of 0.75 to
  -- 1.3 cm) whatever the plant's real size, as an illustrator enlarges a small flower
  local kmin, kmax = max(0.8, 0.7 / r1), min(2.2, max(1.3, 1.25 / r1))
  -- flowers seen in profile (bells, tubes) are drawn smaller, as the tops are (PROFILE)
  local kp = O.profile(sp) and PROFILE or 1
  if kind == "solitary" then kmin, kmax = kp * kmin, kp * kmax end
  local rows = {
    unit("unit", 5, min(kmin, kmax), kmax, 0, true),
    row("budding", { w = 3, smin = 0.5, smax = 1.1, limit = cu, claim = 0.65, layer = L_BLOOM, upright = 0.6, spring = 3, autumn = 0.3,
      r = function(d) return 0.6 * d end, off = function(d) return 0.55 * d end,
      draw = function(rng, d) O.draw("budding", sp, pgfseed(rng), { k = d / fd1 }) end }),
  }
  -- the hero's side branches end in big flowers too, as v1.3's capped `flower` row
  -- (when its cluster is not one flower already); open in summer, bud or fruit else
  if i == 1 and kind ~= "solitary" then
    rows[#rows + 1] = row("bloom", { w = 3, smin = 1.5 * kp, smax = 2.6 * kp, hard = true, limit = cu,
      layer = L_BLOOM, spring = 0.3, autumn = 0.6, bloom = true,
      r = function(d) return 0.5 * d end, off = function() return 0 end,
      draw = function(rng, d, _, h)
        local stage = 1.2 * sea - O.lateness(sp, h or 0.5) + sp.phenology
        if sea >= 0.75 and sea < 1 then stage = max(0.8, stage) end
        O.draw("bloom", sp, pgfseed(rng), { d = d, stage = stage })
      end })
  end
  -- the same, smaller and later: an umbel or a raceme as airy as v1.3's sprays, single
  -- flowers and loose clusters as v1.3's blossoms (the shared cap keeps any one of them
  -- from filling a region)
  rows[#rows + 1] = unit("spray", 3, 0.45, 0.7, 0.1)
  if sp.clade ~= "monocot" then                -- a monocot's leaves rise from its base, not from branches
    rows[#rows + 1] = row("leaf", { w = 1, smin = 0.9, smax = 2.0, layer = L_LEAF, upright = 0.2, spring = 1.3, autumn = 1.2,
      r = function(s) return 0.32 * s * leafc end, off = function(s) return 0.5 * s * leafc end,
      draw = function(rng, s)
        local z = pgfseed(rng)
        O.draw("leaf", sp, z, { len = s * leafc, bend = rng.sym(0.3), lc = rng.u(), season = sea })
      end })
  end
  if sp.tendrils == 1 or sp.habit == "climbing" then
    rows[#rows + 1] = row("tendril", { w = 1.4, smin = 0.3, smax = 0.5, claim = 0.65, layer = L_AIRY, spring = 2, autumn = 1.3,
      r = function(s) return s end, off = function(s) return s end,
      draw = function(rng, s) O.draw("tendril", sp, pgfseed(rng), { size = s }) end })
  end
  return rows
end

-- the species' visitors (M7f), sampled from genomes of their own (florilegium-species.lua's
-- vsample) and drawn by florilegium-native.lua. A visitor's size on the page (cm) from
-- its real one (mm), small ones enlarged most, as an illustrator draws them: a butterfly
-- about 1.3 cm across and a bee 0.8 cm long, as v1.3's; a bird half as large again
local function vsize(v) return 0.29 * v.size ^ 0.38 * (v.group == "bird" and 1.4 or 1) end
-- the room it takes, in sizes: half a wingspan, a bee's or a bird's spread wings, a
-- dragonfly's four
local VROOM = { lepidoptera = 0.5, bee = 0.6, fly = 0.6, beetle = 0.5, odonate = 0.72, bird = 0.6, larva = 0.8,
  snail = 0.6 }
local VSP = { seed = 0, role = "visitor" }           -- the organs' draw wants a species; a visitor has none
local function vdraw(z, role, s) ORG.draw("visitor", VSP, 0, { seed = z, role = role, size = s }) end
-- a visitor as a motif row that flies in (pollinators, by the plant whose row it is; a
-- dragonfly by the monocot): one of each a page, of its own size, a butterfly's head up
-- and a bird upright
local function visitor_row(name, z, role)
  local v = SPC.vsample(z, role)
  -- a nectar bird at the flowers hovers (perched, it would stand on nothing): the next seed
  while v.group == "bird" and v.pose ~= "hover" do z = z % 2147483645 + 1 v = SPC.vsample(z, role) end
  local s = vsize(v)
  return { name = name, kind = "visitor", group = "g:visitor", fly = true, visitor = v, w = 1.5,
    smin = s, smax = s, hard = true, limit = 1, layer = L_ACCENT,
    heading = v.group == "lepidoptera" and "up" or v.group == "bird" and "upright" or "any",
    r = function(k) return VROOM[v.group] * k end, off = function() return 0 end,
    draw = function(_, k) vdraw(z, role, k) end }
end
M.VCAP = 4                                           -- flying visitors a page, at most

-- ---------------------------------------------------------------- page
-- With g.anim set, the page is recorded instead of written, and the
-- recording is returned with its events timed: { rec, total }.
-- g.density (option density, 0..1, default 1) thins the garden: the loops stop at
-- larger holes, proxies keep more room around them, fewer leaves and fillers.
function M.page(g)
  M.theme(g.theme)
  if composition then return composition(g, M) end
  local D = g.density or 1
  -- low on the dial the structure thins out too: two main stems below 0.6, one
  -- below 0.25; no footer below 0.2, no ghosts below 0.4, no snail or bird below 0.3
  local NSTEM = D >= 0.6 and 3 or D >= 0.25 and 2 or 1
  local FOOTER = D >= 0.2
  local rng = ink.rng(g.seed * 7919 + 13)
  local layout = rng.fork()                 -- decisions; primitives get their own forks
  ink.set_transform(ink.page_transform(g.mirror and g.pw))

  -- animation: each event's output is tagged { event, from, to }, visible
  -- while the event's progress is in [from, to)
  local anim = g.anim
  local events, now = {}, nil
  local function event(e)
    if not anim then return nil end
    e.root = e.parent and e.parent.root or e
    events[#events + 1] = e
    now = e
    ink.tag({ e, 0 })
    return e
  end
  if anim then ink.record(true) end
  -- visitors come from their own stream, so a page without them is unchanged; the
  -- species' visitors from one of their own, as they are other animals: pollinators
  -- (flower), a snail, a bird on a twig, a caterpillar on its leaf, a dragonfly or
  -- damselfly by the monocot or a ladybird on a stem
  local spc = F == flora                    -- the species garden; a theme grows v1.3's
  local vis = ink.rng(g.seed * 7919 + (spc and 503 or 101))
  local visiting
  if g.visitors == false then visiting = {}
  elseif spc then
    visiting = { flower = vis.chance(0.9), snail = vis.chance(0.4), bird = vis.chance(0.22), leaf = vis.chance(0.35),
      stem = vis.chance(0.35) }
  else
    visiting = { butterfly = vis.chance(0.75), bee = vis.chance(0.6), snail = vis.chance(0.4), bird = vis.chance(0.22) }
  end
  if D < 0.3 then visiting.snail, visiting.bird, visiting.leaf, visiting.stem = false, false, false, false end
  local vlist = {}                          -- species: the visitors that came, for the page's words
  -- the season (g.age: 0 spring, 0.5 summer, 1 autumn; nil is summer as it always
  -- was): a value for each season, blended; its own stream for what it adds
  local age = g.age
  local function season(sp, su, au)
    if not age then return su end
    if age < 0.5 then return lerp(sp, su, smoothstep(0.1, 0.5, age)) end
    return lerp(su, au, smoothstep(0.5, 0.9, age))
  end
  local spring, autumn = season(1, 0, 0), season(0, 0, 1)
  local sea = ink.rng(g.seed * 7919 + 211)
  local blooms = {}                         -- the flowers, for the petals that fall in autumn
  -- species: the page's plants (comm[k] grows on main stem k, comm[4], a spray, on the footer),
  -- their rows, and the organs' season; nil without the option (or with a theme)
  local comm, rowsof, osea = nil, nil, nil
  local stemv                               -- species: a ladybird for a stem
  if spc then
    if not ORG then SPC, ORG = require("florilegium-species"), require("florilegium-native") end
    comm = SPC.community(SPC.pool(g.docseed or 0), ink.rng(g.seed * 7919 + 307))
    osea = season(0.3, 0.75, 1.25)
    rowsof = {}
    for i, sp in ipairs(comm) do
      local rows = species_rows(sp, i, osea)
      -- the visitor its flowers are for (none for the wind)
      if sp.syndrome ~= "wind" then
        local r = visitor_row("visitor:" .. i, pgfseed(vis), sp.syndrome)
        rows[#rows + 1] = r visiting[r.name] = visiting.flower
      end
      rowsof[sp] = rows
    end
    -- off the flowers: a dragonfly or damselfly flies by the monocot, a ladybird climbs a stem
    local z = pgfseed(vis)
    local v = SPC.vsample(z, "stem")
    if v.group == "odonate" then
      if comm[3] then
        local r = visitor_row("visitor:stem", z, "stem")
        rowsof[comm[3]][#rowsof[comm[3]] + 1] = r visiting[r.name] = visiting.stem
      end
    else stemv = { z = z, v = v } end
  end
  local topof = {}                          -- species: the height of each plant's top

  local rects, col, foot, spill, fx1 = M.regions(g, layout)
  local fld = M.field(rects)
  local gx, gy, free, each_near, disc, free_at = fld.x, fld.y, fld.free, fld.each_near, fld.disc, fld.free_at
  local sdist = {}                          -- distance to the nearest stem point
  for i = 1, #gx do sdist[i] = math.huge end

  -- stem points: {x, y, tx, ty, w, species}; a branch may start at any of them
  local spts = {}
  local function add_stem_points(pts, w0, w1, every, sp)
    every = every or 1
    local n = #pts
    for i = 1, n, every do
      local a, b = pts[max(1, i - 1)], pts[min(n, i + 1)]
      local tx, ty = norm(b[1] - a[1], b[2] - a[2])
      local p = pts[i]
      spts[#spts + 1] = { p[1], p[2], tx, ty, lerp(w0, w1, (i - 1) / max(1, n - 1)), sp }
      each_near(p[1], p[2], REACH, function(j)
        local d = dist(gx[j], gy[j], p[1], p[2])
        if d < sdist[j] then sdist[j] = d end
      end)
    end
  end
  -- the nearest stem point (species: of plant sp, if given and it has any)
  local function nearest_stem(x, y, sp)
    local best, bp = math.huge, nil
    for _, p in ipairs(spts) do
      if not sp or p[6] == sp then
        local d = dist(x, y, p[1], p[2])
        if d < best then best, bp = d, p end
      end
    end
    if sp and not bp then return nearest_stem(x, y) end
    return bp, best
  end
  local function stem(pts, w0, w1, proxy)
    ink.layer(L_STEM)
    if anim then
      -- growing: the first k/n of its length, for progress in [k/n, (k+1)/n)
      local s, L = ink.arclen(pts)
      local n, j = max(1, floor(L / GROWSTEP)), 1
      now.len = L
      for k = 1, n - 1 do
        local at = L * k / n
        while s[j + 1] < at do j = j + 1 end
        local d = s[j + 1] - s[j]
        local u = d > 1e-9 and (at - s[j]) / d or 0
        local head = {}
        for i = 1, j do head[i] = pts[i] end
        head[j + 1] = { lerp(pts[j][1], pts[j + 1][1], u), lerp(pts[j][2], pts[j + 1][2], u) }
        ink.tag({ now, k / n, (k + 1) / n })
        F.stem(head, w0, lerp(w0, w1, k / n), nil, nil, 0.4)
      end
      ink.tag({ now, 1 })
    end
    F.stem(pts, w0, w1)
    if anim then ink.tag({ now, 0 }) end
    for i = 1, #pts, 2 do disc(pts[i][1], pts[i][2], proxy or 0.1, 1) end
  end
  -- draw a primitive at (x,y) with its +y axis at angle `a` (degrees from +x).
  -- In the animation it opens, or with path(e) -> x, y, a it travels to its place
  -- in `steps` positions and fn gets the progress e.
  local function place(layer, x, y, a, fn, path, steps)
    ink.layer(layer)
    if anim then
      -- a few earlier copies with the same random draws, then the real one
      local r0, l0 = rng.save(), layout.save()
      local n = path and (steps or FLYSTEPS) or #BLOOM
      for k = 1, n do
        ink.tag({ now, (k - 1) / n, k / n })
        ink.push()
        if path then
          local px, py, pa = path((k - 1) / n)
          ink.translate(px, py) ink.rotate(pa - 90) fn((k - 1) / n)
        else
          ink.translate(x, y) ink.rotate(a - 90) ink.scale(BLOOM[k]) fn()
        end
        ink.pop()
        rng.load(r0) layout.load(l0)
      end
      ink.tag({ now, 1 })
    end
    ink.push() ink.translate(x, y) ink.rotate(a - 90) fn() ink.pop()
    if anim then ink.tag({ now, 0 }) end
  end
  -- a flight path for the animation: from distance d in direction `from` (degrees),
  -- easing out, swinging sideways by `swing`, wobbling about the final heading
  local function arrive(x, y, a, d, from, swing)
    local ux, uy = cos(from * rad), sin(from * rad)
    return function(e)
      local q = 1 - (1 - e) ^ 2
      local w = swing * sin(pi * q)
      return x + d * ux * (1 - q) - uy * w, y + d * uy * (1 - q) + ux * w, a + 25 * sin(3 * pi * e) * (1 - q)
    end
  end
  -- the explained animation marks the free disc a branch grows to, and its stem point
  local function overlay(parent, x, y, r, S)
    if not anim then return end
    local e = { kind = "overlay", parent = parent, root = parent.root }
    events[#events + 1] = e
    local old = ink.tag({ e, 0, 1, overlay = true })
    ink.layer(L_OVERLAY)
    ink.circle(x, y, r) ink.stroke(ink.accent(0), 0.7, 0.9, false, "[2.5 2] 0")
    ink.circle(x, y, 0.035) ink.fill(ink.accent(0))
    ink.circle(S[1], S[2], 0.05) ink.fill(ink.accent(0))
    ink.tag(old)
  end

  -- ---------------------------------------------------------- 1. stems
  local root = { layout.range(1.0, 1.6), 0.75 }
  local midx = g.colright * 0.47              -- where the stems sway about
  local amp = g.colright * 0.2
  local mains, mainev = {}, {}
  local tops = { g.ph - 2.6, g.ph * layout.range(0.6, 0.72), g.ph * layout.range(0.36, 0.48) }
  for k = 1, NSTEM do
    local f = ink.fbm1(layout, 2)
    local ph, lam = layout.range(0, 10), layout.range(6, 9)
    local x0 = root[1] + (k - 2) * 0.25
    local pts = {}
    local y = root[2]
    while y <= tops[k] do
      local x = midx + amp * f(y / lam + ph) + (k - 2) * 0.35
      x = lerp(x0, x, smoothstep(0, 4, y - root[2]))
      x = max(0.9, min(g.colright - 0.9, x))
      pts[#pts + 1] = { x, y }
      y = y + 0.25
    end
    mains[k] = pts
    mainev[k] = event({ kind = "stem", phase = "stems" })
    local w0 = k == 1 and 0.085 or 0.065
    stem(pts, w0, 0.028)
    add_stem_points(pts, w0, 0.028, nil, comm and comm[k])
    if comm then topof[comm[k]] = pts[#pts][2] end
  end
  -- the scroll: the root curls into a spiral at the corner
  do
    local pts = {}
    local turns = layout.range(1.2, 1.6)
    for i = 0, 40 do
      local t = i / 40
      local a = pi * 0.5 + t * turns * 2 * pi
      local r = 0.55 * (1 - 0.85 * t) ^ 1.3
      pts[#pts + 1] = { root[1] - 0.55 + r * cos(a) * -1, root[2] + 0.05 + r * sin(a) }
    end
    event({ kind = "stem", phase = "stems", off = 0.3 })
    stem(pts, 0.06, 0.012)
  end
  -- the footer stem: from the root along the bottom, tapering out to a hairline
  local footpts, footev = {}, nil
  if FOOTER then
    local f = ink.fbm1(layout, 2)
    local ybase = (foot[2] + foot[4]) / 2 - 0.05
    local x = root[1]
    while x <= fx1 - 0.3 do
      local u = smoothstep(root[1], root[1] + 1.5, x)
      local y = lerp(root[2] + 0.1, ybase + 0.22 * f(x / 3.5), u)
      footpts[#footpts + 1] = { x, y }
      x = x + 0.2
    end
    footev = event({ kind = "stem", phase = "stems", off = 0.5 })
    stem(footpts, 0.065, 0.01, 0.06)
    add_stem_points(footpts, 0.065, 0.012, nil, comm and comm[4])
    if comm then topof[comm[4]] = g.ph * 0.3 end         -- a low plant: its flowers open as a stem's lower ones
  end
  -- species: on some pages the document's fern grows at the root beside the four plants
  -- (a stream of its own decides, as the visitors' does, so a page without one is as it
  -- was): two to four fronds arching out of a crown, most into the column, the left ones
  -- shorter (the paper's edge is near); in spring still unrolling from fiddleheads, each a
  -- little behind or ahead of the season; two in five of the open ones turned to show the
  -- sori; a dimorphic fern's fertile frond upright among them from midsummer. Their discs
  -- along each frond keep the plants' leaves and branches out of it
  local fern, nfronds = nil, 0
  if comm then
    local fs = ink.rng(g.seed * 7919 + 401)
    if fs.chance(0.4) and D >= 0.35 then
      fern = SPC.fern(g.docseed or 0)
      local n = fs.int(2, 4)
      local fronds = {}
      for i = 1, n do
        local f = n == 1 and 0 or -1 + 2 * (i - 1) / (n - 1)
        local a = 70 - 38 * f + fs.sym(8)
        local arch = (f < 0 and 1 or -1) * (25 + 60 * fern.curl) * (0.5 + 0.5 * abs(f)) * fs.range(0.8, 1.2)
        local L = min(7.5, g.ph * 0.24) * (f < 0 and 0.75 or 1) * (1 - 0.15 * abs(f)) * fs.range(0.85, 1)
        local un = max(0, min(1, (osea - 0.1 - fern.phenology - fs.range(0, 0.3)) / 0.4))
        fronds[#fronds + 1] = { a = a, arch = arch, L = L, un = un, under = un >= 0.97 and fs.chance(0.4), lc = fs.u() }
      end
      if fern.dimorphic == 1 and osea > 0.55 then
        table.insert(fronds, 1 + n // 2, { a = 84 + fs.sym(6), arch = fs.sym(12), L = min(7.5, g.ph * 0.24) * fs.range(0.55, 0.7),
          un = 1, fertile = true, lc = fs.u() })
      end
      local x0, y0 = root[1] + 0.3, root[2] + 0.02
      for i, fr in ipairs(fronds) do
        -- the spine as the frond draws it, in page cm, for its discs
        local fo = fr.un < 1 and fern.stipe + (1 - fern.stipe) * (0.3 + 0.7 * fr.un) or 1
        local px, py, rot = 0, 0, (fr.a - 90) * rad
        local reach = (1 - fern.stipe) * ({ lanceolate = 0.26, oblong = 0.2, ovate = 0.32, deltoid = 0.42 })[fern.outline]
        if fr.fertile then reach = 0.45 * reach end
        for k = 1, 32 do
          local sk = fo * (k - 0.5) / 32
          local th = (90 + fr.arch * sk ^ 1.5) * rad
          px, py = px + fo / 32 * cos(th), py + fo / 32 * sin(th)
          if k % 3 == 0 then
            local x = x0 + fr.L * (px * cos(rot) - py * sin(rot))
            local y = y0 + fr.L * (px * sin(rot) + py * cos(rot))
            disc(x, y, sk > fern.stipe and 0.75 * reach * fr.L or 0.12, 0.7)
          end
        end
        event({ kind = "bloom", phase = "stems", off = 0.5 + 0.3 * i, size = 1 })
        place(L_LEAF, x0, y0, fr.a, function()
          ORG.draw("frond", fern, pgfseed(rng.fork()), { len = fr.L, unroll = fr.un, arch = fr.arch, fertile = fr.fertile,
            under = fr.under, lc = fr.lc, season = osea })
        end)
      end
      nfronds = #fronds
    end
  end

  -- on the last page, branches arch out of the main stems into the space under
  -- the text, each ending in a flower
  local leafy = {}
  for k = 1, NSTEM do leafy[k] = { pts = mains[k], big = true, ev = mainev[k], sp = comm and comm[k], w0 = k == 1 and 0.085 or 0.065 } end
  local arcs, arcev, arcsp = {}, {}, {}
  if spill then
    local sh = spill[4] - spill[2]
    local nb = max(1, floor(sh / 7))
    if D < 1 then nb = floor(nb * D + 0.5) end
    for b = 1, nb do
      local y0 = spill[2] + sh * (b - 0.75) / nb
      local si = layout.int(1, NSTEM)
      if comm then si = (b - 1) % NSTEM + 1 end           -- species: each plant reaches under the text in turn
      local src = mains[si]
      local best, bi = math.huge, 1
      for i, p in ipairs(src) do local d = abs(p[2] - y0) if d < best then best, bi = d, i end end
      local s0 = src[bi]
      local w = spill[3] - s0[1]
      local x3 = s0[1] + w * layout.range(0.7, 0.88)
      local y3 = min(spill[4] - 1.4, y0 + sh / nb * layout.range(0.35, 0.6))
      local pts = ink.sample(ink.bezier3(s0[1], s0[2], s0[1] + w * 0.25, s0[2] + layout.range(-0.4, 0.8),
        x3 - w * 0.3, y3 + layout.range(-1.2, -0.3), x3, y3), floor(w / 0.2))
      local f = ink.fbm1(layout, 2)
      for i, p in ipairs(pts) do local u = (i - 1) / (#pts - 1) p[2] = p[2] + 0.35 * f(p[1] / 3) * sin(pi * u) end
      local sa, La = ink.arclen(src)
      local e = event({ kind = "stem", parent = mainev[si], at = sa[bi] / La })
      stem(pts, 0.06, 0.025)
      add_stem_points(pts, 0.06, 0.025, nil, comm and comm[si])
      leafy[#leafy + 1] = { pts = pts, big = true, ev = e, sp = comm and comm[si], w0 = 0.06, w1 = 0.025, branch = true }
      arcs[#arcs + 1] = pts
      arcev[#arcs] = e
      arcsp[#arcs] = comm and comm[si]
    end
  end

  -- the header fleuron keeps its spot free
  disc(g.colright - 0.5, g.headrule + 0.1, 0.7, 1)

  -- ---------------------------------------------------------- 2. terminal flowers and ghosts
  local counts = {}
  for _, m in ipairs(motifs) do counts[m.name] = 0 end
  if fern then counts.fern = nfronds end
  -- species: plant sp's inflorescence at (x, y) along `a` (degrees), its disc as close to
  -- radius `target` as its scale range [kmin, kmax] allows; returns the disc
  local function top(sp, x, y, a, target, kmin, kmax, ev, single)
    local row = rowsof[sp][1]
    local _, _, kind = ORG.unitdisc(sp, 1)
    if single == "hero" or single and (kind == "solitary" or kind == "blossoms") then
      -- the terminal flower alone, as large as a v1.3 page's hero: it opens first (the
      -- hero role is a big flower at the top, whatever the rest of the plant carries)
      local stage = 1.2 * osea - ORG.lateness(sp, 1) + sp.phenology
      if single == "hero" then stage = max(0.8, stage) end     -- open and full size, until it fruits
      -- a bell, tube, pea or two-lipped flower reaches out from its stalk, a solid shape
      -- most of its diameter long: smaller, it carries a face-on flower's weight
      if ORG.profile(sp) then target = PROFILE * target end
      event({ kind = "bloom", parent = ev, at = 1, size = target })
      place(L_BLOOM, x, y, a, function()
        ORG.draw("bloom", sp, pgfseed(rng.fork()), { d = 2 * target, stage = stage })
      end)
      counts[row.name], counts[row.group] = counts[row.name] + 1, counts[row.group] + 1
      blooms[#blooms + 1] = { x, y, target }
      return x, y, target
    end
    local k = max(kmin, min(kmax, target / row.r(1)))
    local o, r = ORG.unitdisc(sp, k)
    local cx, cy = x + cos(a * rad) * o, y + sin(a * rad) * o
    event({ kind = "bloom", parent = ev, at = 1, size = r })
    place(row.layer, x, y, a, function()
      ORG.draw("unit", sp, pgfseed(rng.fork()), { k = k, season = osea, late = ORG.lateness(sp, 1) })
    end)
    counts[row.name], counts[row.group] = counts[row.name] + 1, counts[row.group] + 1
    if row.bloom then blooms[#blooms + 1] = { cx, cy, r } end
    return cx, cy, r
  end
  if comm then
    for _, sp in ipairs(comm) do for _, m in ipairs(rowsof[sp]) do counts[m.name] = 0 end end
    for group in pairs(M.GROUPS) do counts["g:" .. group] = 0 end
    counts["g:visitor"] = 0
    -- the same draws as below, so the stems and their tops stay where they were
    local p, q = mains[1][#mains[1]], mains[1][#mains[1] - 2]
    local hx, hy = norm(p[1] - q[1], p[2] - q[2])
    local s = min(1.75, g.colright * 0.27)
    local cx, cy, r = top(comm[1], p[1], p[2], deg(hx, hy), 1.05 * s, 0.9, 1.6, mainev[1], "hero")
    disc(cx, cy, r, 0.85)
    for k = 2, NSTEM do
      local pts = mains[k]
      local p2, q2 = pts[#pts], pts[#pts - 2]
      local ax, ay = norm(p2[1] - q2[1], p2[2] - q2[2])
      local sk = k == 2 and 0.95 * layout.range(1.0, 1.2) or layout.range(0.85, 1.0)
      cx, cy, r = top(comm[k], p2[1], p2[2], deg(ax, ay), sk, 0.6, 1.3, mainev[k], true)
      disc(cx, cy, r, 0.85)
    end
  else
    local p, q = mains[1][#mains[1]], mains[1][#mains[1] - 2]
    local hx, hy = norm(p[1] - q[1], p[2] - q[2])
    local s = min(1.75, g.colright * 0.27)
    local fx, fy = p[1] + hx * 0.2, p[2] + hy * 0.2
    event({ kind = "bloom", parent = mainev[1], at = 1, size = s })
    place(L_BLOOM, fx, fy, 90, function() F.flower(rng.fork(), s) end)
    disc(fx, fy, 1.05 * s, 0.85)
    blooms[#blooms + 1] = { fx, fy, s }
    for k = 2, NSTEM do
      local pts = mains[k]
      local p2, q2 = pts[#pts], pts[#pts - 2]
      local ax, ay = norm(p2[1] - q2[1], p2[2] - q2[2])
      -- the shorter stems end in a lily and a flower; in spring in buds, in autumn gone to seed
      local tip = spring > 0.5 and "bud" or autumn > 0.5 and "seedhead" or nil
      if k == 2 then
        local s2 = layout.range(1.0, 1.2)
        event({ kind = "bloom", parent = mainev[2], at = 1, size = s2 })
        if tip == "bud" then
          place(L_BLOOM, p2[1], p2[2], deg(ax, ay), function() F.bud(rng.fork(), 0.95 * s2) end)
        elseif tip == "seedhead" then
          place(L_AIRY, p2[1] + ax * 0.15, p2[2] + ay * 0.15, 90, function() F.seedhead(rng.fork(), 0.75 * s2) end)
        else
          place(L_BLOOM, p2[1] + ax * 0.25 * s2, p2[2] + ay * 0.25 * s2, deg(ax, ay), function() F.lily(rng.fork(), s2) end)
        end
        disc(p2[1] + ax * 0.3 * s2, p2[2] + ay * 0.3 * s2, 0.95 * s2, 0.85)
        counts.lily = counts.lily + 1
      else
        local s3 = layout.range(0.85, 1.0)
        event({ kind = "bloom", parent = mainev[3], at = 1, size = s3 })
        if tip == "bud" then
          place(L_BLOOM, p2[1], p2[2], deg(ax, ay), function() F.bud(rng.fork(), 0.9 * s3) end)
        elseif tip == "seedhead" then
          place(L_AIRY, p2[1], p2[2], 90, function() F.seedhead(rng.fork(), 0.75 * s3) end)
        else
          place(L_BLOOM, p2[1], p2[2], 90, function() F.flower(rng.fork(), s3) end)
          blooms[#blooms + 1] = { p2[1], p2[2], s3 }
        end
        disc(p2[1], p2[2], s3, 0.85)
        counts.flower = counts.flower + 1
      end
    end
  end
  for b, pts in ipairs(arcs) do
    local p = pts[#pts]
    local s = layout.range(1.0, 1.25)
    if comm then
      local q = pts[#pts - 2]
      local ax, ay = norm(p[1] - q[1], p[2] - q[2])
      local cx, cy, r = top(arcsp[b], p[1], p[2], deg(ax, ay), s, 0.6, 1.3, arcev[b], true)
      disc(cx, cy, r, 0.85)
    else
      event({ kind = "bloom", parent = arcev[b], at = 1, size = s })
      place(L_BLOOM, p[1], p[2], 90, function() F.flower(rng.fork(), s) end)
      disc(p[1], p[2], s, 0.85)
      counts.flower = counts.flower + 1
      blooms[#blooms + 1] = { p[1], p[2], s }
    end
  end
  -- ghosts: large pale flowers behind, given a little room so they show (species: the
  -- hero's flower, plain and pale, as in the TikZ library's garden)
  do
    local ng = layout.int(1, 2)
    if D < 0.4 then ng = 0 end
    for k = 1, ng do
      local gxp = g.colright * layout.range(0.35, 0.65)
      local gyp = g.ph * (k == 1 and layout.range(0.15, 0.3) or layout.range(0.45, 0.6))
      local s = layout.range(1.3, 1.6)
      event({ kind = "bloom", phase = "ghost", i = k })
      if comm then
        place(L_GHOST, gxp, gyp, 90, function() ORG.draw("ghost", comm[1], pgfseed(rng.fork()), { d = 2 * s }) end)
      else
        place(L_GHOST, gxp, gyp, 90, function() F.ghost(0.62, function() F.flower(rng.fork(), s) end) end)
      end
      disc(gxp, gyp, 0.8 * s, 0.6)
    end
  end

  -- a branch from stem point S to a motif at (bx,by) whose axis is (ax,ay)
  local function branch_to(S, bx, by, ax, ay, w0, ev)
    local pts = F.branch_path(layout, S[1], S[2], S[3], S[4], bx, by, ax, ay)
    local d = dist(S[1], S[2], bx, by)
    local w = min(S[5] * 0.7, w0)
    stem(pts, w, max(0.012, w * 0.45), 0.07)
    add_stem_points(pts, w, max(0.012, w * 0.45), 2, S[6])
    -- a leaflet or two on a longer branch
    if d > 1.0 then
      local nl = d > 2 and 2 or 1
      for j = 1, nl do
        local i = floor(#pts * (0.25 + 0.3 * j / nl))
        local p, q = pts[i], pts[i + 1]
        local a = deg(q[1] - p[1], q[2] - p[2]) + (j % 2 == 0 and 1 or -1) * layout.range(40, 60)
        local ls = layout.range(0.45, 0.75)
        event({ kind = "bloom", parent = ev, at = i / #pts, size = ls })
        place(L_LEAF, p[1], p[2], a, function() ink.scale(ls) F.leaflet(rng.fork()) end)
        disc(p[1] + cos(a * rad) * ls * 0.5, p[2] + sin(a * rad) * ls * 0.5, 0.25 * ls, 0.7)
      end
    end
    return pts
  end

  -- ---------------------------------------------------------- marks: flowers the text asks for
  -- beside a heading (option sections) or wherever \florilegiumbloom[motif] stands:
  -- the motif sits at the column's edge at the height of that line, on a branch
  -- from the nearest stem; where there is no room (the hero flower) it is left out
  -- species: a heading gets the nearest plant's flowers (level 1) or buds (level 2);
  -- \florilegiumbloom[x] takes flower, bud(ding), leaf, tendril, a role (hero, showy,
  -- monocot, spray; lily is the monocot) or a body plan on the page, else any other motif
  local ROLE = { hero = 1, showy = 2, monocot = 3, lily = 3, spray = 4 }
  local function species_mark(mk)
    local sp = nearest_stem(g.colright - 0.8, mk.y)[6] or comm[1]
    local kind, s, a = "unit", 0.8, mk.kind == "bloom" and mk.arg or ""
    if mk.kind == "heading" then kind = mk.arg == 1 and "unit" or "budding"
    elseif a == "bud" or a == "budding" then kind = "budding"
    elseif a == "leaf" then kind, s = "leaf", 1.4
    elseif a == "tendril" then kind, s = "tendril", 0.4
    elseif ROLE[a] then sp = comm[ROLE[a]]
    elseif a ~= "" and a ~= "flower" then
      local named
      for _, c in ipairs(comm) do if c.plan == a then named = c end end
      if not named then
        local m = M.motifs[a]
        return m, m and (m.smin + m.smax) / 2
      end
      sp = named
    end
    for _, m in ipairs(rowsof[sp]) do if m.kind == kind then return m, s, sp end end
    local m = M.motifs[a]                     -- a plant without tendrils
    return m, m and (m.smin + m.smax) / 2
  end
  local nmarks = 0
  for _, mk in ipairs(g.marks or {}) do
    local m, s, want
    if comm then m, s, want = species_mark(mk)
    elseif mk.kind == "heading" then
      m, s = M.motifs[mk.arg == 1 and "flower" or "blossoms"], mk.arg == 1 and 0.95 or 0.7
    else
      m = M.motifs[mk.arg ~= "" and mk.arg or "flower"]
      s = m and (mk.arg == "" and 0.9 or (m.smin + m.smax) / 2)
    end
    if m then
      local r = m.r(s)
      local px, py = g.colright - r - 0.15, mk.y + 0.12
      local f = free_at(px, py)
      if f < 0.95 * r then
        local lo, hi = m.smin * 0.8, s
        for _ = 1, 20 do local mid = (lo + hi) / 2 if m.r(mid) > f * 0.95 then hi = mid else lo = mid end end
        s = lo r = m.r(s)
      end
      if r <= f * 1.15 and py > 0.6 + r and py < g.ph - 0.6 - r then
        local S = nearest_stem(px, py, want)
        local dx, dy = norm(px - S[1], py - S[2])
        local ax, ay = norm(dx, dy + (m.upright or 0))
        local ox, oy = px - ax * m.off(s), py - ay * m.off(s)
        local h = S[6] and min(1, py / topof[S[6]])           -- species: the height on its plant
        nmarks = nmarks + 1
        local bev = event({ kind = "stem", phase = "marks", i = nmarks })
        if m.fly then
          event({ kind = "bloom", parent = bev, at = 1, span = 1.2 })
          place(m.layer, px, py, 90, function(p) m.draw(rng.fork(), s, p) end, arrive(px, py, 90, 3, 200, 0.5))
        else
          branch_to(S, ox, oy, ax, ay, 0.045, bev)
          event({ kind = "bloom", parent = bev, at = 1, size = r })
          -- a heading's flower is painted in the accent, as headings were rubricated
          local heading = mk.kind == "heading"
          place(m.layer, ox, oy, deg(ax, ay), function()
            if heading then ink.in_accent(function() m.draw(rng.fork(), s, nil, h) end) else m.draw(rng.fork(), s, nil, h) end
          end)
          if m.name == "flower" or m.bloom then blooms[#blooms + 1] = { ox, oy, m.bloom and m.r(s) or s } end
        end
        counts[m.name] = counts[m.name] + 1
        if m.group then counts[m.group] = counts[m.group] + 1 end
        disc(px, py, r, 0.85)
      end
    end
  end

  -- visitors on the stems: a snail crawling up a main stem, and now and then a
  -- bird on a twig of its own
  local function tangent(pts, i)
    local a, b = pts[max(1, i - 1)], pts[min(#pts, i + 1)]
    return norm(b[1] - a[1], b[2] - a[2])
  end
  if visiting.snail then
    local s, sz, sv                          -- species: the genome's snail, at its size
    if comm then sz = pgfseed(vis) sv = SPC.vsample(sz, "snail") s = vsize(sv) else s = vis.range(0.75, 0.9) end
    local best, c = -1, nil
    for _ = 1, 12 do
      local k = vis.int(1, NSTEM)
      local pts = mains[k]
      local i = vis.int(max(10, floor(#pts * 0.15)), max(11, floor(#pts * 0.45)))
      local side = vis.chance(0.5) and 1 or -1
      local tx, ty = tangent(pts, i)
      local nx, ny = ty * side, -tx * side             -- toward the shell
      local f = free_at(pts[i][1] + nx * 0.8 * s, pts[i][2] + ny * 0.8 * s)
      if f > best then best, c = f, { k = k, i = i, side = side, nx = nx, ny = ny } end
    end
    if c and best > 0.25 then
      local pts = mains[c.k]
      local sa, La = ink.arclen(pts)
      local i0 = max(1, c.i - 8)                       -- it crawls up the last 2 cm
      local function at(e)
        local j = lerp(i0, c.i, e)
        local j0 = floor(j)
        local j1 = min(#pts, j0 + 1)
        local p, q = pts[j0], pts[j1]
        local tx, ty = tangent(pts, j0)
        local u = j - j0
        return lerp(p[1], q[1], u) + c.nx * 0.03, lerp(p[2], q[2], u) + c.ny * 0.03, deg(tx, ty)
      end
      local x, y, a = at(1)
      -- a snail withdrawn into its shell does not crawl: it appears where it stays
      local crawl = not (sv and sv.withdrawn == 1)
      event({ kind = "bloom", parent = mainev[c.k], at = sa[c.i] / La, till_end = crawl })
      place(L_ACCENT, x, y, a, function()
        ink.scale(c.side, 1)
        if sv then vdraw(sz, "snail", s) else F.snail(rng.fork(), s) end
      end, crawl and at or nil, crawl and 40 or nil)
      disc(pts[c.i][1] + c.nx * 0.36 * s, pts[c.i][2] + c.ny * 0.36 * s, 0.5 * s, 1)
      counts.snail = 1
      if sv then vlist[#vlist + 1] = { kind = "snail", group = "snail", text = SPC.vdescribe(sv), at = "stem" } end
    end
  end
  if visiting.bird then
    local s, bz, bv                          -- species: a seed-eater from its genome
    if comm then bz = pgfseed(vis) bv = SPC.vsample(bz, "perch") s = vsize(bv) else s = vis.range(2.3, 2.7) end
    local best, c = -1, nil
    for _ = 1, 24 do
      local k = vis.int(1, NSTEM)
      local pts = mains[k]
      local i = vis.int(floor(#pts * 0.25), floor(#pts * 0.75))
      local p = pts[i]
      local dir = vis.chance(0.5) and 1 or -1
      local L = vis.range(1.2, 1.7)
      local ex, ey = p[1] + dir * L, p[2] + vis.range(0.05, 0.4)
      local bx, by = ex - dir * 0.25, ey
      local facing = vis.chance(0.65) and dir or -dir
      local bodyx, bodyy = bx + facing * 0.03 * s, by + 0.4 * s
      local f = min(free_at(bodyx, bodyy) / (0.36 * s), free_at(bx - facing * 0.35 * s, by + 0.15 * s) / (0.2 * s))
      if f > best then best, c = f, { k = k, i = i, ex = ex, ey = ey, dir = dir, facing = facing, cx = bodyx, cy = bodyy } end
    end
    if c and best > 1 then
      local pts = mains[c.k]
      local p = pts[c.i]
      local tx, ty = tangent(pts, c.i)
      local sa, La = ink.arclen(pts)
      local twig = F.branch_path(vis, p[1], p[2], tx, ty, c.ex, c.ey, c.dir, 0.1)
      local tev = event({ kind = "stem", parent = mainev[c.k], at = sa[c.i] / La })
      stem(twig, 0.05, 0.02, 0.07)
      add_stem_points(twig, 0.05, 0.02, 2, comm and comm[c.k])
      local perch = twig[max(1, floor(#twig * 0.85))]
      event({ kind = "bloom", parent = tev, at = 1, span = 1.4 })
      place(L_ACCENT, perch[1], perch[2], 90, function()
        if bv then ink.scale(c.facing, 1) vdraw(bz, "perch", s) else F.bird(rng.fork(), s, { facing = c.facing }) end
      end, arrive(perch[1], perch[2], 90, 3.5, c.facing > 0 and 160 or 20, 0.6), FLYSTEPS)
      disc(c.cx, c.cy, 0.36 * s, 0.9)
      disc(perch[1] - c.facing * 0.35 * s, perch[2] + 0.15 * s, 0.2 * s, 0.9)
      counts.bird = 1
      if bv then vlist[#vlist + 1] = { kind = bv.kind, group = "bird", text = SPC.vdescribe(bv), at = "twig" } end
    end
  end
  -- species: a caterpillar on a leaf of its own at a node of a broad-leaved plant (its
  -- leaf, bitten, as long as one and a half caterpillars, held out and up from the stem)
  if comm and visiting.leaf then
    local cz = pgfseed(vis)
    local cv = SPC.vsample(cz, "caterpillar")
    local s = vsize(cv)
    local Lf, best, c = 1.5 * s, -1, nil
    for _ = 1, 16 do
      local k = vis.int(1, min(2, NSTEM))
      local pts = mains[k]
      local i = vis.int(max(4, floor(#pts * 0.2)), max(5, floor(#pts * 0.7)))
      local side = vis.chance(0.5) and 1 or -1
      local tx, ty = tangent(pts, i)
      local ax, ay = norm(ty * side + tx, -tx * side + ty)       -- out from the stem, leaning up
      local f = free_at(pts[i][1] + ax * 0.6 * Lf, pts[i][2] + ay * 0.6 * Lf) / (0.42 * Lf)
      if f > best then best, c = f, { k = k, i = i, side = side, ax = ax, ay = ay } end
    end
    if c and best > 0.8 then
      local p = mains[c.k][c.i]
      local sa, La = ink.arclen(mains[c.k])
      event({ kind = "bloom", parent = mainev[c.k], at = sa[c.i] / La, size = 0.5 * Lf })
      place(L_ACCENT, p[1], p[2], deg(c.ax, c.ay), function()
        if c.side < 0 then ink.scale(-1, 1) end
        vdraw(cz, "caterpillar", s)
      end)
      disc(p[1] + c.ax * 0.6 * Lf, p[2] + c.ay * 0.6 * Lf, 0.5 * Lf, 0.9)
      vlist[#vlist + 1] = { kind = "caterpillar", group = "larva", text = SPC.vdescribe(cv), at = "leaf" }
    end
  end
  -- species: a ladybird climbing a main stem
  if stemv and visiting.stem then
    local s = vsize(stemv.v)
    local best, c = -1, nil
    for _ = 1, 12 do
      local k = vis.int(1, NSTEM)
      local pts = mains[k]
      local i = vis.int(max(10, floor(#pts * 0.2)), max(11, floor(#pts * 0.7)))
      local tx, ty = tangent(pts, i)
      local p = pts[i]
      local f = min(free_at(p[1] + ty * 0.5 * s, p[2] - tx * 0.5 * s),
        free_at(p[1] - ty * 0.5 * s, p[2] + tx * 0.5 * s))
      if f > best then best, c = f, { k = k, i = i } end
    end
    if c and best > 0.3 * s then
      local pts = mains[c.k]
      local sa, La = ink.arclen(pts)
      local i0 = max(1, c.i - 6)                       -- it climbs the last centimeter and a half
      local function at(e)
        local j = lerp(i0, c.i, e)
        local j0 = floor(j)
        local j1 = min(#pts, j0 + 1)
        local p, q = pts[j0], pts[j1]
        local tx, ty = tangent(pts, j0)
        local u = j - j0
        return lerp(p[1], q[1], u), lerp(p[2], q[2], u), deg(tx, ty)
      end
      local x, y, a = at(1)
      event({ kind = "bloom", parent = mainev[c.k], at = sa[c.i] / La, till_end = true })
      place(L_ACCENT, x, y, a, function() vdraw(stemv.z, "stem", s) end, at, 30)
      disc(x, y, 0.55 * s, 1)
      vlist[#vlist + 1] = { kind = stemv.v.kind, group = "beetle", text = SPC.vdescribe(stemv.v), at = "stem" }
    end
  end

  -- ---------------------------------------------------------- 3. leaves at the nodes
  -- big stems get full leaves, alternating sides, smaller toward the top; the
  -- footer gets leaflets that thin out toward its end
  if FOOTER then leafy[#leafy + 1] = { pts = footpts, big = false, ev = footev } end
  -- species: the plant's own leaves (its arrangement: one, two or three at a node, a
  -- lily's too; a basal rosette; an iris's or a grass's straps from the base and two leaves
  -- up the stem), smaller up the stem by the species' taper. A branch under the text
  -- (st.branch) starts partway up its plant, so it has no root: no rosette or straps
  local function species_leaves(st)
    local sp, pts = st.sp, st.pts
    -- a leaf at (x, y) along a; fore: foreshortened (a decussate pair's), sa, w: the stem's
    -- direction and width at a node, for a sheathing leaf's sheath
    local function leafat(x, y, a, Lf, u, side, fore, sa, w)
      fore = fore or 1
      local ux, uy = cos(a * rad), sin(a * rad)
      local ok = false
      for _ = 1, 3 do
        if free_at(x + ux * Lf * fore * 0.55, y + uy * Lf * fore * 0.55) >= 0.24 * Lf * fore then ok = true break end
        Lf = Lf * 0.75
      end
      if not (ok and Lf > 0.7) then return end
      local bend, lc = side * layout.range(0.05, 0.3), layout.u()
      local sheath = sa and sp.attachment == "sheathing" and { sa - a, 1.8 * w / Lf } or nil
      event({ kind = "bloom", parent = st.ev, at = u, size = 0.4 * Lf })
      place(L_LEAF, x, y, a, function()
        ORG.draw("leaf", sp, pgfseed(rng.fork()), { len = Lf, bend = bend, lc = lc, season = osea,
          fore = fore < 1 and fore or nil, sheath = sheath })
      end)
      for _, f in ipairs({ 0.3, 0.55, 0.8 }) do disc(x + ux * Lf * fore * f, y + uy * Lf * fore * f, 0.24 * Lf * fore, 0.85) end
    end
    local w0, w1 = st.w0 or 0.06, st.w1 or 0.028
    -- the taper by the height on the plant, so a branch under the text keeps the leaves of
    -- the height it leaves the stem at
    local function sized(y) return 2.4 * (1 - (1 - sp.taper) * min(1, y / topof[sp])) end
    local total, cum = 0, { 0 }
    for i = 2, #pts do total = total + dist(pts[i][1], pts[i][2], pts[i - 1][1], pts[i - 1][2]) cum[i] = total end
    local function tangent_at(i)
      return norm(pts[min(#pts, i + 1)][1] - pts[max(1, i - 1)][1], pts[min(#pts, i + 1)][2] - pts[max(1, i - 1)][2])
    end
    local leafc = leafc_of(sp)
    local young = season(0.8, 1, 1)
    local b0 = pts[1]
    if sp.clade == "monocot" and sp.arrangement ~= "alternate" and sp.arrangement ~= "whorled" then
      local nb = st.branch and 0 or layout.int(3, 5)
      local H = pts[#pts][2] - b0[2]
      for b = 1, nb do
        local f = (b - (nb + 1) / 2) / max(1, (nb - 1) / 2)
        local a = 90 - 24 * f + layout.sym(5)
        local Lf = min(7, H * layout.range(0.3, 0.46)) * (1 - 0.25 * abs(f)) * young
        leafat(b0[1] + 0.12 * f, b0[2], a, Lf, 0, f < 0 and -1 or 1)
      end
      local side = layout.chance(0.5) and 1 or -1
      for _, u in ipairs({ layout.range(0.22, 0.3), layout.range(0.42, 0.52) }) do
        local i = 2
        while i < #pts and cum[i] < u * total do i = i + 1 end
        side = -side
        local tx, ty = tangent_at(i)
        local Lf = sized(pts[i][2]) * layout.range(0.85, 1.1) * 0.75 * leafc * young
        leafat(pts[i][1], pts[i][2], deg(tx, ty) + side * layout.range(35, 60), Lf, u, side, 1, deg(tx, ty), lerp(w0, w1, u))
      end
      return
    end
    local arr = sp.arrangement
    local per, gap, leafk = 1, 1, 1
    -- pairs and whorls further apart than single leaves, so a stem carries about as
    -- much leaf whatever its arrangement
    if arr == "opposite" then per, gap = 2, 1.7 elseif arr == "whorled" then per, gap = 3, 2.2 end
    if arr == "rosette" then
      local nb = st.branch and 0 or layout.int(3, 5)
      for b = 1, nb do
        local f = (b - (nb + 1) / 2) / max(1, (nb - 1) / 2)
        leafat(b0[1], b0[2] + 0.1, 90 - 62 * f + layout.sym(8), layout.range(1.6, 2.3) * leafc * young, 0, f < 0 and 1 or -1)
      end
      gap, leafk = 1.6, 0.4
    end
    local acc, side, node = layout.range(0.6, 1.3) * gap, layout.chance(0.5) and 1 or -1, 0
    for i = 2, #pts - 4 do
      if cum[i] >= acc then
        local u = cum[i] / total
        acc = acc + layout.range(1.4, 2.2) * gap / D ^ 0.6
        side = -side
        node = node + 1
        local tx, ty = tangent_at(i)
        for b = 1, per do
          local ls = b == 2 and -side or side
          local t = b == 3 and layout.range(8, 20) or layout.range(35, 60)
          -- decussate: every other opposite pair, turned across the last, points toward the
          -- viewer and away: close to the stem and foreshortened
          local fore = 1
          if per == 2 and node % 2 == 0 then t, fore = 0.55 * t, 0.55 end
          local a = deg(tx, ty) + ls * t
          local Lf = sized(pts[i][2]) * layout.range(0.85, 1.1) * leafk * leafc * (b == 3 and 0.7 or 1) * young
          leafat(pts[i][1], pts[i][2], a, Lf, u, ls, fore, deg(tx, ty), lerp(w0, w1, u))
        end
      end
    end
  end
  for _, st in ipairs(leafy) do
    if st.sp and st.big then species_leaves(st) else
      local pts = st.pts
      local s, acc, side = 0, layout.range(0.6, 1.3), layout.chance(0.5) and 1 or -1
      local total = 0
      for i = 2, #pts do total = total + dist(pts[i][1], pts[i][2], pts[i - 1][1], pts[i - 1][2]) end
      for i = 2, #pts - 4 do
        s = s + dist(pts[i][1], pts[i][2], pts[i - 1][1], pts[i - 1][2])
        if s >= acc then
          local u = s / total
          acc = acc + (st.big and layout.range(1.4, 2.2) or lerp(0.55, 1.4, u) * layout.range(0.8, 1.2)) / D ^ 0.6
          side = -side
          local tx, ty = norm(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][2] - pts[i - 1][2])
          local a = deg(tx, ty) + side * layout.range(35, 60)
          local ux, uy = cos(a * rad), sin(a * rad)
          local Lf = st.big and lerp(2.4, 1.3, pts[i][2] / g.ph) * layout.range(0.85, 1.1) or lerp(0.95, 0.45, u) * layout.range(0.85, 1.1)
          Lf = Lf * season(0.8, 1, 1)                     -- young leaves are small
          local ok = false
          for _ = 1, 3 do
            local mx, my = pts[i][1] + ux * Lf * 0.55, pts[i][2] + uy * Lf * 0.55
            if free_at(mx, my) >= 0.24 * Lf then ok = true break end
            Lf = Lf * 0.75
          end
          if ok and Lf > (st.big and 0.7 or 0.3) then
            event({ kind = "bloom", parent = st.ev, at = u, size = 0.4 * Lf })
            if st.big then
              local lobed = layout.chance(0.6)
              local bend = side * layout.range(0.05, 0.3)
              -- young leaves are pale; in autumn some turn copper
              local copper = autumn > 0 and sea.chance(0.35 * autumn)
              place(L_LEAF, pts[i][1], pts[i][2], a, function()
                local function leaf()
                  ink.scale(Lf) F.leaf(rng.fork(), { w = layout.range(0.22, 0.3), depth = lobed and layout.range(0.4, 0.8) or 0, bend = bend })
                end
                if copper then ink.in_accent(leaf) elseif spring > 0 then F.ghost(0.3 * spring, leaf) else leaf() end
              end)
            else
              local bend = -side * layout.range(0.1, 0.3)
              place(L_LEAF, pts[i][1], pts[i][2], a, function() ink.scale(Lf) F.leaflet(rng.fork(), { bend = bend }) end)
            end
            for _, f in ipairs({ 0.3, 0.55, 0.8 }) do disc(pts[i][1] + ux * Lf * f, pts[i][2] + uy * Lf * f, 0.24 * Lf, 0.85) end
          end
        end
      end
    end
  end

  -- ---------------------------------------------------------- 4. branches to the largest holes
  local area = 0
  for _, r in ipairs(rects) do area = area + (r[3] - r[1]) * (r[4] - r[2]) end
  local af = max(1, area / 175)
  local caps = {}
  for _, m in ipairs(motifs) do caps[m.name] = m.fly and floor(m.max * min(1, 2 * D) + 0.5) or floor(m.max * af * D + 0.5) end   -- visitors stay few
  if comm then
    for group, mx in pairs(M.GROUPS) do caps["g:" .. group] = floor(mx * af * D + 0.5) end
    caps["g:visitor"] = floor(M.VCAP * min(1, 2 * D) + 0.5)
  end
  local nbranch = 0
  local NBMAX = D < 1 and max(1, floor(40 * D)) or math.huge


  for _ = 1, 400 do
    local _, bi = layout.best(free, #gx, 0.85, 1.15, sdist, REACH)
    if not bi or free[bi] < SMALLEST / sqrt(D) or nbranch >= NBMAX then break end
    local f, px, py = free[bi], gx[bi], gy[bi]
    local S = nearest_stem(px, py)
    -- statement motifs have a hard cap; the others only lose weight as they repeat
    -- (species: the rows of the plant whose stem is nearest)
    local elig, wts, wsum = {}, {}, 0
    for _, m in ipairs(comm and S[6] and rowsof[S[6]] or motifs) do
      local c = m.group or m.name                 -- species: the plants share a cap per kind
      local wt = m.w * season(m.spring or 1, m.summer or 1, m.autumn or 1) / (1 + counts[c] / max(1, caps[c]))
      local ok = wt > 0 and m.r(m.smin) <= f * 1.05 and (not m.hard or counts[c] < caps[c]) and (not m.fly or visiting[m.name])
        and (not m.limit or counts[m.name] < m.limit)
      if ok then elig[#elig + 1] = m wts[#elig] = wt wsum = wsum + wt end
    end
    if #elig == 0 then free[bi] = 0 else
      local pick, acc = elig[#elig], layout.u() * wsum
      for k, m in ipairs(elig) do acc = acc - wts[k] if acc <= 0 then pick = m break end end
      local s = pick.smax
      if pick.r(s) > f * 0.95 then
        local lo, hi = pick.smin, s
        for _ = 1, 20 do local mid = (lo + hi) / 2 if pick.r(mid) > f * 0.95 then hi = mid else lo = mid end end
        s = lo
      end
      local dx, dy = norm(px - S[1], py - S[2])
      -- the motif's axis: away from the stem, leaning up for the upright kinds
      local ax, ay = norm(dx, dy + (pick.upright or 0))
      local ox, oy = px - ax * pick.off(s), py - ay * pick.off(s)
      if pick.hang then ox, oy = px - dx * 0.2 * s, py + 0.45 * s end
      nbranch = nbranch + 1
      local bev = event({ kind = "stem", phase = "branch", i = nbranch })
      overlay(bev, px, py, f, S)
      if pick.fly then
        -- a visitor: no branch, any heading, and in the animation it flies in
        local a
        if pick.heading == "upright" then a = 90
        elseif pick.name == "bee" or pick.heading == "any" then a = layout.range(0, 360)
        else a = 90 + layout.sym(50) end
        event({ kind = "bloom", parent = bev, at = 1, span = 1.2 })
        if pick.visitor then
          -- species: a bird faces the plant it came to
          local facing = pick.heading == "upright" and (S[1] < px and -1 or 1) or 1
          place(pick.layer, px, py, a, function(p) ink.scale(facing, 1) pick.draw(rng.fork(), s, p) end,
            arrive(px, py, a, 3, layout.range(0, 360), layout.sym(0.8)))
          local v = pick.visitor
          vlist[#vlist + 1] = { kind = v.kind, group = v.group, text = SPC.vdescribe(v),
            at = pick.name == "visitor:stem" and "monocot" or "flowers" }
        else
          place(pick.layer, px, py, a, function(p) pick.draw(rng.fork(), s, p) end,
            arrive(px, py, a, 3, layout.range(0, 360), layout.sym(0.8)))
        end
      else
        if dist(ox, oy, S[1], S[2]) > 0.12 then
          branch_to(S, ox, oy, pick.hang and dx or ax, pick.hang and -0.3 or ay, 0.04, bev)
        end
        local a = pick.hang and 90 or deg(ax, ay)
        event({ kind = "bloom", parent = bev, at = 1, size = pick.r(s) })
        if pick.sp then
          local h = min(1, py / topof[pick.sp])                 -- species: the height on its plant
          place(pick.layer, ox, oy, a, function() pick.draw(rng.fork(), s, nil, h) end)
          if pick.bloom then blooms[#blooms + 1] = { ox, oy, pick.r(s) } end
        else
          place(pick.layer, ox, oy, a, function() pick.draw(rng.fork(), s) end)
          if pick.name == "flower" then blooms[#blooms + 1] = { ox, oy, s } end
        end
      end
      counts[pick.name] = counts[pick.name] + 1
      if pick.group then counts[pick.group] = counts[pick.group] + 1 end
      disc(px, py, pick.r(s) * (2 - D) * (pick.claim or 1), 0.85)
    end
  end

  -- autumn: loose petals fall from the flowers into the free space below them
  -- (in the animation they drift down from the flower)
  if autumn > 0 then
    local nfall = 0
    for _, b in ipairs(blooms) do
      for _ = 1, sea.int(0, floor(3 * autumn + 0.5)) do
        local best, bx, by = 0.16, nil, nil
        for _ = 1, 6 do
          local x, y = b[1] + sea.sym(1.1), b[2] - b[3] - sea.range(0.1, 2.2)
          local f = free_at(x, y)
          if f > best then best, bx, by = f, x, y end
        end
        if bx then
          local ps, pa, pt = sea.range(0.4, 0.6), sea.range(0, 360), sea.range(0.36, 0.5)
          local sway, x0, y0 = sea.sym(0.6), b[1] + sea.sym(0.3), b[2] - 0.3 * b[3]
          nfall = nfall + 1
          event({ kind = "bloom", phase = "fall", i = nfall, span = 1.6 })
          place(L_BLOOM, bx, by, pa, function() ink.scale(ps) F.petal(rng.fork(), { tone = pt, heart = false }) end,
            function(e)
              return lerp(x0, bx, e) + sway * sin(2 * pi * e), lerp(y0, by, e * e * (3 - 2 * e)), pa - 140 * (1 - e)
            end, 16)
          disc(bx, by, 0.22, 1)
        end
      end
    end
  end

  -- ---------------------------------------------------------- 5. small holes
  -- only right next to a stem, and not too many: a pair of leaflets at a node,
  -- a bud, or a few florets. Far from any stem, a copper accent or nothing.
  local accents, fills = 0, 0
  local maxfill = floor(28 * af * D)
  for _ = 1, 600 do
    local _, bi = layout.best(free, #gx, 0.85, 1.15)
    if not bi or free[bi] < FILLMIN / D then break end
    local f, px, py = free[bi], gx[bi], gy[bi]
    local S, sd = nearest_stem(px, py)
    if sd < 0.75 and fills < maxfill then
      fills = fills + 1
      event({ kind = "bloom", phase = "fill", i = fills, size = f })
      local dx, dy = norm(px - S[1], py - S[2])
      local ax, ay = norm(dx, dy + 0.4)
      local kind = layout.u()
      if kind < 0.4 then
        -- two leaflets in a V at the stem point
        local axis = deg(ax, ay)
        local ls = min(0.75, f * 1.6)
        for k = -1, 1, 2 do
          local a = axis + k * layout.range(20, 35)
          place(L_LEAF, S[1], S[2], a, function() ink.scale(ls * layout.range(0.8, 1)) F.leaflet(rng.fork(), { bend = -k * 0.15 }) end)
        end
      elseif kind < 0.65 then
        local ox, oy = px - ax * f * 0.5, py - ay * f * 0.5
        ink.layer(L_STEM)
        ink.moveto(S[1], S[2]) ink.curveto(S[1] + S[3] * 0.15, S[2] + S[4] * 0.15, ox - ax * 0.1, oy - ay * 0.1, ox, oy)
        ink.stroke(tone(0.1), 0.4)
        if comm and S[6] then                                    -- species: a bud of the plant
          place(L_BLOOM, ox, oy, deg(ax, ay), function()
            ORG.draw("bloom", S[6], pgfseed(rng.fork()), { d = min(0.6, f * 1.7) / 0.55, stage = 0.15 })
          end)
        else
          place(L_BLOOM, ox, oy, deg(ax, ay), function() F.bud(rng.fork(), min(0.6, f * 1.7)) end)
        end
      else
        -- a small cluster of florets on hairline stalks
        local n = layout.int(2, 4)
        for k = 1, n do
          local qx, qy = px + layout.sym(f * 0.5), py + layout.sym(f * 0.5)
          ink.layer(L_STEM)
          ink.moveto(S[1], S[2]) ink.curveto(S[1] + S[3] * 0.1, S[2] + S[4] * 0.1, (S[1] + qx) / 2, (S[2] + qy) / 2 + 0.05, qx, qy)
          ink.stroke(tone(0.12), 0.25, 0.9)
          place(L_BLOOM, qx, qy, 90, function() F.floret(rng.fork(), min(0.11, f * 0.6) * layout.range(0.8, 1.1)) end)
        end
      end
    elseif sd >= 0.75 and accents < 6 * D and f > 0.22 and px < g.colright then
      accents = accents + 1
      event({ kind = "bloom", phase = "accent", i = accents, size = 0.3 })
      if layout.chance(0.6) then
        place(L_ACCENT, px, py, 90, function() F.sparkle(rng.fork(), 0.13) end)
      else
        place(L_ACCENT, px, py, 90, function() F.rosette(rng.fork(), 0.12) end)
      end
    end
    disc(px, py, max(f, 0.3), 1)
  end

  -- ---------------------------------------------------------- 6. the footer's tail
  if FOOTER then
    local e = footpts[#footpts]
    local x2 = e[1] + layout.range(1.6, 2.2)
    ink.layer(L_ACCENT)
    local c = { e[1], e[2], e[1] + 0.6, e[2] + 0.05, x2 - 0.6, e[2] - 0.05, x2, e[2] }
    local tail = event({ kind = "stem", phase = "tail", len = x2 - e[1] })
    if anim then
      for k = 1, 7 do
        ink.tag({ tail, k / 8, (k + 1) / 8 })
        ink.moveto(c[1], c[2]) ink.curveto(bezier_head(c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], k / 8))
        ink.stroke(ink.accent(0), 0.3, 0.8)
      end
      ink.tag({ tail, 1 })
    end
    ink.moveto(c[1], c[2]) ink.curveto(c[3], c[4], c[5], c[6], c[7], c[8])
    ink.stroke(ink.accent(0), 0.3, 0.8)
    event({ kind = "bloom", parent = tail, at = 1, size = 0.3 })
    place(L_ACCENT, x2 + 0.18, e[2], 90, function() F.sparkle(rng.fork(), 0.12, { rays = false }) end)
    ink.circle(x2 + 0.45, e[2], 0.025) ink.fill(ink.accent(0))
  end

  -- assemble: a safety clip a little outside the regions, then the layers. With g.bleed
  -- (florilegium-svg.lua's --bleed, for e-books and screens) the sides that run along the
  -- paper's edge reach that far past it, so nothing is cut there
  ink.tag(nil)
  ink.layer(0)
  local bleed = g.bleed or 0
  for _, r in ipairs(rects) do
    local x1, y1, x2, y2 = r[1] - 0.25, r[2] - 0.3, r[3] + (r == col and 0.25 or 0.3), r[4] + 0.3
    if bleed > 0 then
      -- a footer band squeezed by a small bottom margin comes out upside down (its top
      -- below its bottom); order it first, or the bleed moves it off the paper
      if y2 < y1 then y1, y2 = y2, y1 end
      if r[1] < 0.6 then x1 = x1 - bleed end
      if r[2] < 0.6 then y1 = y1 - bleed end
      if r[3] > g.pw - 0.6 then x2 = x2 + bleed end
      if r[4] > g.ph - 0.6 then y2 = y2 + bleed end
    end
    ink.poly({ { x1, y1 }, { x2, y1 }, { x2, y2 }, { x1, y2 } }, true)
  end
  ink.clip()
  ink.layer(99)
  ink.unclip()
  local n, seen = 0, {}
  for k, v in pairs(counts) do if k:sub(1, 2) ~= "g:" then n = n + v end end
  if comm then
    for _, v in ipairs(vlist) do seen[#seen + 1] = v.kind end
  else
    for _, name in ipairs({ "butterfly", "bee", "snail", "bird" }) do
      if (counts[name] or 0) > 0 then seen[#seen + 1] = counts[name] .. " " .. name end
    end
  end
  if anim then
    local total = schedule(events)
    if texio then texio.write_nl(string.format("florilegium: recorded %d motifs, %d events, %.1f s of growth", n, #events, total)) end
    return { rec = ink.take_recording(), total = total }
  end
  local bytes = ink.flush()
  -- species: the page's four, in stem order (the hero, a second showy plant, the monocot,
  -- the footer's spray), with what they carry; grew: it had a stem (low density grows
  -- fewer main stems, and no footer)
  local plants
  if comm then
    plants = {}
    for i, sp in ipairs(comm) do
      local tally = {}
      for _, m in ipairs(rowsof[sp]) do if m.sp then tally[m.kind] = counts[m.name] end end
      plants[i] = { role = ({ "hero", "showy", "monocot", "spray" })[i], plan = sp.plan, clade = sp.clade,
        syndrome = sp.syndrome, seed = sp.seed, text = SPC.describe(sp), tally = tally, grew = topof[sp] ~= nil }
    end
  end
  if texio then
    texio.write_nl(string.format("florilegium: grew %d cells, %d motifs, %d stem points, %.0f KB; visitors: %s",
      #gx, n, #spts, bytes / 1024, #seen > 0 and table.concat(seen, ", ") or "none"))
    if plants then
      local names = {}
      for _, p in ipairs(plants) do names[#names + 1] = p.plan .. " " .. p.seed end
      texio.write_nl("florilegium: species " .. table.concat(names, ", "))
    end
  end
  -- what grew, for a page that describes its own garden (florilegium-svg.lua and the playground)
  -- the fern, if the page has one (not among the four: it has no stem of its own)
  local fernstat = fern and { plan = fern.plan, seed = fern.seed, text = SPC.describe(fern), fronds = nfronds } or nil
  return { stats = { motifs = n, counts = counts, stems = #spts, cells = #gx, species = plants, fern = fernstat,
    visitors = comm and vlist or nil } }
end

return M
