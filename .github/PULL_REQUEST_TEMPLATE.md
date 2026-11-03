<!-- What does this change, and why? For anything visual, a before and after crop of a page
     says more than a description. CONTRIBUTING.md explains the checks below. -->



- [ ] I looked at the output (a page, a specimen sheet or the playground), and it looks right.
- [ ] Pages that should not change are byte-identical before and after (`tools/ident.lua`), or the change in the drawing is intended.
- [ ] If `web/` changed, `tools/playcheck` passes.
- [ ] If a primitive or `florilegium-grow.lua` changed, the PostScript port has the same change, or this PR says it doesn't.
- [ ] US spelling throughout.
