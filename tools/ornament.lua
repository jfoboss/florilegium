-- Draw one primitive as a standalone SVG through florilegium-svg.lua's translator (the playground's ornaments):
--   texlua tools/ornament.lua hedera 1.2 web/hedera.svg   and   ... sparkle 0.5 web/sparkle.svg
package.path = "./?.lua;" .. package.path
local streams = {}
tex = { sprint = function() end }
luatexbase = { registernumber = function() return 0 end }
node = { new = function() return {} end, write = function(n) streams[#streams + 1] = n.data end }
local ink, flora, svg = require("florilegium-ink"), require("florilegium-flora"), require("florilegium-svg")
ink.set_accent(0.70589, 0.4, 0.18431)
local name, size, out = arg[1], tonumber(arg[2]), arg[3]
ink.set_transform({ ink.CM, 0, 0, ink.CM, 200, 200 })
flora[name](ink.rng(tonumber(arg[4] or 7)), size, {})
ink.flush()
local s = table.concat(streams, "\n")
local x0, y0, x1, y1 = math.huge, math.huge, -math.huge, -math.huge
for x, y in s:gmatch("(%-?[%d.]+) (%-?[%d.]+) [mlc]") do
  x, y = tonumber(x), tonumber(y)
  x0, x1, y0, y1 = math.min(x0, x), math.max(x1, x), math.min(y0, y), math.max(y1, y)
end
local pad = 1
local parts = svg.translate(s, {}, "o")
local f = io.open(out, "w")
f:write(string.format('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%.1f %.1f %.1f %.1f"><g transform="matrix(1 0 0 -1 0 %.1f)" stroke-linecap="round" stroke-linejoin="round">\n%s\n</g></svg>\n',
  x0 - pad, -y1 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad, 0, table.concat(parts, "\n")))
f:close()
print(name, string.format("%.0f x %.0f bp", x1 - x0, y1 - y0))
