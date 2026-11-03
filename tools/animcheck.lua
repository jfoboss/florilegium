-- Check that the growth animation ends on exactly the page: for each seed, the
-- last frame of the recording must equal the normal page byte for byte (with and
-- without the spill under the text; in summer, in spring, and in autumn with a
-- heading and a \florilegiumbloom marked in the text; with the geometric theme, with the
-- geometric theme in autumn on a mirrored page, at density 0.4 and 0.05, and the math
-- theme with marks and mirrored at density 0.3). Runs without TeX:
--   texlua tools/animcheck.lua 1 2 3      (or: tools/in-docker texlua tools/animcheck.lua)
tex = { sprint = function() end }
luatexbase = { registernumber = function() return 0 end }
local out
node = { new = function() return {} end, write = function(n) out = n.data end }
package.path = "./?.lua;" .. package.path
local ink, grow = require("florilegium-ink"), require("florilegium-grow")

-- an A4 page with a 68 mm left margin, roughly as in the demo documents
local CASES = {
  { name = "summer" },
  { name = "spring", age = 0.05 },
  { name = "autumn, marks", age = 0.95, marks = { { kind = "heading", arg = 1, y = 20 }, { kind = "bloom", arg = "", y = 9 } } },
  { name = "geometric", theme = "geometric" },
  { name = "geometric, autumn, mirrored", theme = "geometric", age = 0.95, mirror = true,
    marks = { { kind = "heading", arg = 1, y = 20 }, { kind = "bloom", arg = "crystal", y = 9 } } },
  { name = "density 0.4", density = 0.4 },
  { name = "density 0.05", density = 0.05 },
  { name = "math, marks", theme = "math", marks = { { kind = "heading", arg = 1, y = 20 }, { kind = "bloom", arg = "knot", y = 9 } } },
  { name = "math, mirrored, density 0.3", theme = "math", mirror = true, density = 0.3 },
}
local function geometry(seed, spill, case)
  local g = { pw = 21, ph = 29.7, textleft = 6.8, textright = 18.8, ytop = 25.4, ybot = 3.0 }
  g.colright, g.headrule, g.footy = g.textleft - 0.4, g.ytop + 0.7, 1.9
  g.seed, g.spill, g.spilly = seed, spill, spill == 1 and 19.0 or 0
  g.age, g.marks, g.theme, g.mirror, g.density = case.age, case.marks, case.theme, case.mirror, case.density
  return g
end

local seeds = {}
for _, a in ipairs(arg) do seeds[#seeds + 1] = tonumber(a) end
if #seeds == 0 then seeds = { 1, 2, 3, 7 } end
local bad = 0
for _, seed in ipairs(seeds) do
  for _, spill in ipairs({ 0, 1 }) do for _, case in ipairs(CASES) do
    grow.page(geometry(seed, spill, case))
    local page = out
    local g = geometry(seed, spill, case)
    g.anim = true
    local r = grow.page(g)
    ink.emit(r.rec, function(tag)
      if tag.overlay then return false end
      local e = tag[1]
      local p = (math.huge - e.t0) / e.dur           -- as florilegium.lua does for the last frame
      return p >= tag[2] and (tag[3] == nil or p < tag[3])
    end)
    local ok = out == page
    if not ok then bad = bad + 1 end
    print(string.format("\nseed %d, spill %d, %s: %s (%.0f KB, %.1f s of growth)", seed, spill, case.name,
      ok and "last frame = page" or "LAST FRAME DIFFERS", #page / 1024, r.total))
  end end
end
os.exit(bad == 0 and 0 or 1)
