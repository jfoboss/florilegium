-- Lua side of the flora cross-check: texlua flora_case.lua <ref-dir> <cases.lua> <out.txt>
local refdir, casefile, out = arg[1], arg[2], arg[3]
local here = arg[0]:match("^(.*)[/\\]") or "."
package.path = refdir .. "/?.lua;" .. here .. "/../lua/?.lua;" .. package.path
local D = require("detmath")
math.sin, math.cos, math.log = D.sin, D.cos, D.log
math.atan = function(y, x) if x == nil then return D.atan(y) end return D.atan2(y, x) end
__pow = D.pow
local streams = {}
tex = { sprint = function() end }
luatexbase = { registernumber = function() return 0 end }
node = { new = function() return {} end, write = function(n) streams[#streams + 1] = n.data end }
local ink = require("florilegium-ink")
local flora = require("florilegium-flora")
local cases = dofile(casefile)

local res = {}
for _, c in ipairs(cases) do
  streams = {}
  ink.set_transform(ink.page_transform(c.mirror ~= 0 and c.mirror or nil))
  ink.translate(5, 7) ink.rotate(c.rot) ink.scale(c.scale)
  local rng = ink.rng(c.seed)
  local old = ink.set_lift(c.lift)
  local n, s = c.name, c.s
  local ret = ""
  if n == "petal" then flora.petal(rng, {})
  elseif n == "petalp" then flora.petal(rng, { shape = "pointed", heart = false })
  elseif n == "flower" then flora.flower(rng, s)
  elseif n == "lily" then flora.lily(rng, s)
  elseif n == "blossom" then flora.blossom(rng, s * 0.4)
  elseif n == "floret" then flora.floret(rng, s * 0.1)
  elseif n == "floretstar" then flora.floret(rng, s * 0.3, { star = true, tone = 0 })
  elseif n == "bud" then flora.bud(rng, s)
  elseif n == "bell" then flora.bell(rng, s)
  elseif n == "leaf" then flora.leaf(rng, {})
  elseif n == "leaf0" then flora.leaf(rng, { depth = 0 })
  elseif n == "leaflet" then flora.leaflet(rng, {})
  elseif n == "cyme" then flora.cyme(rng, s * 2, { fork = true })
  elseif n == "sprig" then flora.sprig(rng, s * 2)
  elseif n == "umbel" then flora.umbel(rng, s)
  elseif n == "seedhead" then flora.seedhead(rng, s)
  elseif n == "tendril" then flora.tendril(rng, s)
  elseif n == "sparkle" then flora.sparkle(rng, s * 0.2)
  elseif n == "rosette" then flora.rosette(rng, s * 0.2)
  elseif n == "hedera" then local x, y = flora.hedera(rng, s) ret = string.format("%.6f %.6f", x, y)
  elseif n == "butterfly" then flora.butterfly(rng, s * 2, { open = 0.7 })
  elseif n == "bee" then flora.bee(rng, s)
  elseif n == "snail" then flora.snail(rng, s)
  elseif n == "bird" then flora.bird(rng, s * 2)
  elseif n == "birdl" then flora.bird(rng, s * 2, { facing = -1 })
  elseif n == "stem" then flora.stem(flora.walk(0, 0, function(x) return 90 + 30 * x end, 3 * s, 20), 0.05, 0.01)
  elseif n == "stemtip" then flora.stem(flora.walk(0, 0, function(x) return 80 - 20 * x end, 3 * s, 20), 0.08, 0.02, ink.tone(0.2), 0.8, 0.5)
  elseif n == "branch" then local p = flora.branch_path(rng, 0, 0, 0, 1, s * 2, s, 0.6, 0.8) flora.stem(p, 0.03, 0.01)
  elseif n == "ghostflower" then flora.ghost(nil, function() flora.flower(rng, s) end)
  elseif n == "mottle" then ink.circle(0, 0, 1) ink.clip() flora.mottle(rng, -1, -1, 1, 1, 8, 0.2, 0.2, 0.5, 6) ink.unclip()
  elseif n == "streak" then flora.streak(function(v) return v, v * v end, 12, 0.1, 0.01, ink.white, 0.7)
  end
  ink.set_lift(old)
  ink.flush()
  local u = rng.u()
  local hx = (string.pack(">d", u):gsub(".", function(ch) return string.format("%02x", ch:byte()) end))
  res[#res + 1] = table.concat(streams, "\n") .. "\nRET " .. ret .. " U " .. hx
end
local f = io.open(out, "w") f:write(table.concat(res, "\n=====\n")) f:close()
