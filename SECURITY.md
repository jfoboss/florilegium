# Security policy

## Reporting a vulnerability

Please report a security problem privately, through the repository's
[private vulnerability reporting](https://github.com/kevinraymond/florilegium/security/advisories/new)
form, and not in a public issue. Only the maintainer can read the report. This is a
one-person project, so a reply may take a few days. Once a fix is out, the advisory is
published with credit to you, unless you would rather not be named.

Fixes go into the latest release and `main`. Older releases are not patched.

## What the package does on your machine

These are the promises a report can hold the package to.

- `florilegium.sty` and its Lua run inside LuaLaTeX with your document's privileges. They
  run no shell commands and work without `--shell-escape`. They read only the font files
  LuaTeX already uses, and write only the PDF and one line (the page count) to the
  document's `.aux` file.
- Every page is computed from the seed. The one exception is `seed=random`, which you ask
  for by name.
- `florilegium-svg.lua` writes only to standard output or to the file given with `-o`.
- The [playground](https://kevinraymond.github.io/florilegium/) runs entirely in your
  browser. Nothing you choose leaves it; there are no analytics and no server. It loads two
  libraries from jsDelivr, wasmoon and MathJax, and the browser runs them only if they hash to
  the values pinned in `web/*.js`. Its Content-Security-Policy lets no other outside script run.

Any way to break one of these is worth reporting, such as a document or option that makes
the package run code or read or write files it shouldn't, a link to the playground that runs
a script, or a workflow in `.github/` that a pull request could abuse. Things the author of a document
can already do with `\directlua` are outside the package's control.

## Checking a release

From v1.3 on, the PDFs attached to a release are built by GitHub Actions from the release's
tag, and each carries a signed build provenance attestation. To check that a PDF you
downloaded is the one CI built, run

```sh
gh attestation verify florilegium.pdf --repo kevinraymond/florilegium
```

The attestation is also attached to the release, as `florilegium-pdfs.sigstore.json`. Keep it
with the PDF, and the check doesn't need to look the attestation up on GitHub.

```sh
gh attestation verify florilegium.pdf --repo kevinraymond/florilegium --bundle florilegium-pdfs.sigstore.json
```

Published releases are immutable, so their PDFs and tags cannot be swapped afterwards.
