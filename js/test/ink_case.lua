-- The ink cross-check script: Lua side (reference florilegium-ink.lua + detmath).
-- texlua ink_case.lua <ref-dir> <out.txt>
local refdir, out = arg[1], arg[2]
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
local L = {}
local function hx(x) return (string.pack(">d", x):gsub(".", function(c) return string.format("%02x", c:byte()) end)) end
local function emit(tag, ...) local t = { tag } for _, v in ipairs({ ... }) do t[#t + 1] = type(v) == "number" and hx(v) or tostring(v) end L[#L + 1] = table.concat(t, " ") end
local function pts_out(tag, pts) local t = { tag } for _, p in ipairs(pts) do t[#t + 1] = hx(p[1]) .. "," .. hx(p[2]) end L[#L + 1] = table.concat(t, " ") end

-- generator
for _, seed in ipairs({ 0, 1, 7, 42, 123456789, 4294967295, 3.7, 9876543210 }) do
  local r = ink.rng(seed)
  for k = 1, 20 do emit("u", r.u()) end
  emit("rng", r.range(-2, 3), r.sym(1.5), r.int(1, 7), tostring(r.chance(0.4)), r.normal())
  local f = r.fork()
  emit("fork", f.u(), f.u(), r.save())
end
-- noise
local r = ink.rng(5)
local n1, fb = ink.noise1(r), ink.fbm1(r, 4)
for k = -20, 40 do emit("noise", n1(k * 0.37), fb(k * 0.21)) end
-- palette
for t = 0, 1.0001, 0.05 do local c = ink.tone(t) emit("tone", c[1], c[2], c[3]) end
ink.set_ink(0x5B / 255, 0x2A / 255, 0x1F / 255)
for i = 0, 100 do local c = ink.tone(i / 100) emit("ramp", c[1], c[2], c[3]) end
ink.set_accent(0.71, 0.40, 0.18)
ink.in_accent(function() local c = ink.tone(0.4) emit("acc", c[1], c[2], c[3]) end)
local c = ink.accent(0.3) emit("accent", c[1], c[2], c[3])
c = ink.accent(-0.2) emit("accent", c[1], c[2], c[3])
ink.set_lift(0.3) c = ink.tone(0.2) emit("lift", c[1], c[2], c[3]) ink.set_lift(0)
ink.set_pale(0.25) c = ink.tone(0.2) emit("pale", c[1], c[2], c[3]) c = ink.accent() emit("pale", c[1], c[2], c[3]) ink.set_pale(0)
ink.set_ink(0x24 / 255, 0x56 / 255, 0xC4 / 255)
-- transforms and paths
local rr = ink.rng(77)
local function rp(n) local t = {} for i = 1, n do t[i] = { rr.range(-5, 5), rr.range(-5, 5) } end return t end
ink.set_transform(ink.page_transform(12.1))
ink.push() ink.translate(3.3, 4.4) ink.rotate(27.5) ink.scale(0.8, 1.3)
emit("unit", ink.unit()) emit("topage", ink.to_page(1.5, -2.25))
for k = 1, 30 do
  local p = rp(2 + k % 7)
  ink.layer(k % 4)
  if k % 5 == 0 then ink.poly(p, k % 2 == 0) ink.fill(ink.tone(k / 30), 0.6 + (k % 3) * 0.2, k % 2 == 1)
  elseif k % 5 == 1 then ink.smooth(p, k % 2 == 0, 0.5 + k % 3) ink.stroke(ink.tone(0.3), 0.25 * k, k % 3 == 0 and 0.5 or nil, k % 4 == 0, k % 6 == 1 and "[2 2] 0" or nil)
  elseif k % 5 == 2 then ink.circle(p[1][1], p[1][2], 0.3 * k) ink.fill(ink.accent(0.1))
  elseif k % 5 == 3 then ink.taper(p[1][1], p[1][2], p[2][1], p[2][2], 1, 2, 3, 1, 0.2, 0.05) ink.fill(ink.tone(0.5), 0.35)
  else ink.moveto(0, 0) ink.lineto(1, 2) ink.curveto(1, 2, 3, 4, 5, 6) ink.close() ink.clip() ink.flood(ink.tone(0.9), -1, -1, 1, 1) ink.unclip() end
end
ink.pop()
ink.set_transform(ink.page_transform())
ink.smooth(rp(9), true) ink.fill(ink.paper)
ink.flush()
for _, s in ipairs(streams) do L[#L + 1] = "STREAM " .. s end
-- geometry
local p = rp(12)
local nr = ink.normals(p) pts_out("normals", nr)
local s, tot = ink.arclen(p) emit("arclen", tot) pts_out("arcs", (function() local t = {} for i, v in ipairs(s) do t[i] = { v, 0 } end return t end)())
pts_out("ribbon", ink.ribbon(p, function(u) return 0.2 + 0.3 * u end))
pts_out("catmull", ink.catmull(p, 5))
pts_out("bez", ink.sample(ink.bezier3(0, 0, 1, 3, 4, -1, 6, 2), 17, 0.1, 0.9))
local o, ce, nn = ink.blade(function(v) return v * 2, math.sin(v * 3) end, 14, function(v) return 0.4 * math.sin(math.pi * v) end,
  function(v) return 0.3 * __pow(v, 0.7) end, function(v, side) return 0.05 * side * math.cos(9 * v) end)
pts_out("blade", o) pts_out("bladec", ce) pts_out("bladen", nn)
pts_out("blob", ink.blob(ink.rng(3), 1, 2, 0.7, 0.4, 0.3, 11))
pts_out("blob9", ink.blob(ink.rng(4), -1, 0, 0.5, 0.5, 0.2))
local f = io.open(out, "w") f:write(table.concat(L, "\n"), "\n") f:close()
