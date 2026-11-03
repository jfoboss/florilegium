# Contributing to florilegium

Thank you for taking the time. Bug reports, ideas, pictures of the margins in your own
documents, and pull requests are all welcome.

## Where things go

- **Questions, ideas and thanks** go to
  [Discussions](https://github.com/kevinraymond/florilegium/discussions).
- **Bugs** go to [issues](https://github.com/kevinraymond/florilegium/issues/new/choose).
  The form asks for your TeX Live version and the log, which is usually what it takes to
  reproduce one.
- **Security problems** are reported privately, as [SECURITY.md](SECURITY.md) describes.

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Building

The README's [Build](README.md#build) section has every target. Without a local TeX, build
the Docker image once (`docker build -t florilegium-tex tools`) and add
`RUN=tools/in-docker` to any `make` command.

## Before you open a pull request

The project has a few rules that are easy to break without noticing. [CLAUDE.md](CLAUDE.md)
explains each of them in its "Conventions and traps" section.

- **Look at the output.** Build a page (`make`, or `make seed-7`) and look at it. A margin
  can be wrong in ways no test notices.
- **Pages are deterministic.** The same seed draws the same page byte for byte under
  LuaLaTeX, Lua 5.3, Lua 5.4 and the playground. `tools/svgcheck.sh` checks this, and CI runs
  it on every pull request. A change that should leave the drawing alone must leave it
  byte-identical; `tools/ident.lua` writes 45 pages to compare before and after.
- **The playground** has its own check: serve the repository (`make playground`) and run
  `tools/playcheck` (see the comment at the top of `check.mjs`).
- **US spelling** everywhere, in code, comments and docs.
- **The PostScript port** is not kept in sync automatically. If you change a primitive or
  `florilegium-grow.lua`, say in the pull request whether `postscript/florilegium.ps` needs the same
  change.
- **Credit what you borrow.** A published algorithm or constant gets a credit where it is
  used and a line under the README's Credits.

## Dependencies

The workflows pin every action to a full commit SHA, and Dependabot proposes updates in one
grouped pull request a month. The playground pins wasmoon and MathJax by hash; to move
either to a new version, change its URL in `web/` and use the hash `tools/sri.sh` reports
(the Content-Security-Policy in `web/index.html` names the MathJax version too).

## License

By contributing, you agree that your contribution is released under the project's
[MIT License](LICENSE).
