-- Write the content streams of 45 pages to a directory, one file each, without TeX:
-- five seeds of the grown composition, with and without the space under the text, in
-- summer, without visitors, in spring and in autumn with marks, and the authored one.
-- Run it before and after a change that should not move anything, and compare:
--   texlua tools/ident.lua build/ident-before    (or: tools/in-docker texlua ...)
--   ... change ...
--   texlua tools/ident.lua build/ident-after && diff -r build/ident-before build/ident-after
tex = { sprint = function() end }
luatexbase = { registernumber = function() return 0 end }
local out
node = { new = function() return {} end, write = function(n) out = n.data end }
package.path = "./?.lua;" .. package.path
local ink, grow, authored = require("florilegium-ink"), require("florilegium-grow"), require("florilegium-authored")
local dir = assert(arg[1], "usage: texlua tools/ident.lua <directory>")
os.execute("mkdir -p " .. dir)
local CASES = {
  { name = "summer" },
  { name = "novis", visitors = false },
  { name = "spring", age = 0.05 },
  { name = "autumn-marks", age = 0.95, marks = { { kind = "heading", arg = 1, y = 20 }, { kind = "heading", arg = 2, y = 14 }, { kind = "bloom", arg = "", y = 9 }, { kind = "bloom", arg = "umbel", y = 6 } } },
}
local function geometry(seed, spill, case)
  local g = { pw = 21, ph = 29.7, textleft = 6.8, textright = 18.8, ytop = 25.4, ybot = 3.0 }
  g.colright, g.headrule, g.footy = g.textleft - 0.4, g.ytop + 0.7, 1.9
  g.seed, g.spill, g.spilly = seed, spill, spill == 1 and 19.0 or 0
  g.age, g.marks, g.visitors = case.age, case.marks, case.visitors
  for k, v in pairs(case.extra or {}) do g[k] = v end
  return g
end
local function save(name)
  local f = assert(io.open(dir .. "/" .. name, "w")) f:write(out) f:close()
end
for _, seed in ipairs({ 1, 2, 3, 6, 7 }) do
  for _, spill in ipairs({ 0, 1 }) do for _, case in ipairs(CASES) do
    grow.page(geometry(seed, spill, case))
    save(string.format("grow-%d-%d-%s", seed, spill, case.name))
  end end
  local g = geometry(seed, 0, {})
  authored.page(g)
  save("authored-" .. seed)
end
print("wrote " .. dir)
