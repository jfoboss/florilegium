-- ref_page.lua -- the reference florilegium page for cross-checking the port.
--   texlua ref_page.lua <ref-dir> <native|det> <out.svg> key=value ...
-- native: __pow = the native ^, built-in math (checks the ^ substitution);
-- det:    sin, cos, atan, log and pow from detmath.lua, what the JS port is checked against.
local refdir, mode, out = arg[1], arg[2], arg[3]
local here = arg[0]:match("^(.*)[/\\]") or "."
package.path = refdir .. "/?.lua;" .. here .. "/?.lua;" .. package.path

if mode == "det" then
  local D = require("detmath")
  math.sin, math.cos, math.log = D.sin, D.cos, D.log
  math.atan = function(y, x) if x == nil then return D.atan(y) end return D.atan2(y, x) end
  __pow = D.pow
else
  __pow = function(a, b) return a ^ b end
end

local o = { head = false }
for i = 4, #arg do
  local k, v = arg[i]:match("^([%w_]+)=(.*)$")
  if v == "true" then v = true elseif v == "false" then v = false end
  o[k] = v
end
if o.paper and type(o.paper) == "string" then
  local w, h = o.paper:match("^(%d+%.?%d*)x(%d+%.?%d*)$")
  if w then o.paper = { w .. "mm", h .. "mm" } end
end
local svg = require("florilegium-svg")
local s = svg.page(o)
local f = assert(io.open(out, "w"))
f:write(s)
f:close()
