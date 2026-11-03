// captions.js -- the text a theme sets in the margin (the math theme's symbols and
// equations), typeset by MathJax in the browser where LuaLaTeX would use TeX, and
// placed as florilegium.lua places its TikZ nodes: the same anchor, size, rotation,
// color and opacity. MathJax's fonts are Computer Modern, so it reads as TeX does;
// it is not TeX's own output, so these are the one part not identical to a PDF.
// Copyright (c) 2026 Kevin Raymond. MIT License: see LICENSE or florilegium.sty.

// only the bytes published to npm as MathJax 3.2.2 (Subresource Integrity, as in worker.js)
const MATHJAX = ['https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js', 'sha384-KKWa9jJ1MZvssLeOoXG6FiOAZfAgmzsIIfw8BXwI9+kYm0lPCbC6yTQPBC00F1/L']
const BP = 72 / 2.54                              // bp per cm
const PT = 72 / 72.27                             // bp per TeX point

let loading = null
function mathjax() {
  if (loading) return loading
  window.MathJax = {
    loader: { load: [] },
    startup: { typeset: false },
    options: { enableMenu: false },
    svg: { fontCache: 'none' },                   // every glyph inline: the SVG stands alone
  }
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = MATHJAX[0]
    s.integrity = MATHJAX[1]
    s.crossOrigin = 'anonymous'                   // integrity needs a CORS fetch
    s.onload = () => window.MathJax.startup.promise.then(resolve, reject)
    s.onerror = () => reject(new Error('could not load MathJax'))
    document.head.appendChild(s)
  })
  return loading
}

// "$x$ and text" -> MathJax input: math as it is, the rest as \text{}
function input(tex) {
  return tex.split('$').map((part, i) => i % 2 ? part : part && `\\text{${part.replace(/[{}]/g, '\\$&')}}`).join('')
}

// where TikZ's anchor sits on a box [x, y, w, h] (y down, as MathJax's viewBox is)
function anchorPoint(a, [x, y, w, h]) {
  const ax = /west/.test(a) ? x : /east/.test(a) ? x + w : x + w / 2
  const ay = /north/.test(a) ? y : /south/.test(a) ? y + h : /base/.test(a) ? 0 : y + h / 2
  return [ax, ay]
}

// the captions as one SVG group in page coordinates (y down, H = page height in bp)
export async function captionsSVG(caps, H) {
  if (!caps || !caps.length) return ''
  await mathjax()
  const ser = new XMLSerializer()
  const out = ['<g class="florilegium-captions">']
  for (const c of caps) {
    const svg = window.MathJax.tex2svg(input(c.tex), { display: false }).querySelector('svg')
    const box = svg.getAttribute('viewBox').split(/\s+/).map(Number)
    const [ax, ay] = anchorPoint(c.anchor, box)
    const k = c.size * PT / 1000                  // MathJax draws in thousandths of an em
    const body = Array.from(svg.childNodes).map((n) => ser.serializeToString(n)).join('')
      .replace(/ xmlns="[^"]*"/g, '').replace(/ data-[\w-]+="[^"]*"/g, '')
    out.push(`<g transform="translate(${(c.x * BP).toFixed(2)} ${(H - c.y * BP).toFixed(2)}) rotate(${(-c.rotate).toFixed(1)}) ` +
      `scale(${k.toFixed(5)}) translate(${(-ax).toFixed(1)} ${(-ay).toFixed(1)})" color="${c.color}"` +
      (c.opacity < 1 ? ` opacity="${c.opacity}"` : '') + `>${body}</g>`)
  }
  out.push('</g>')
  return out.join('\n')
}

// the page's SVG with its captions set in
export async function withCaptions(svg, caps) {
  if (!caps || !caps.length) return svg
  const H = Number(svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1])
  const i = svg.lastIndexOf('</svg>')
  return svg.slice(0, i) + (await captionsSVG(caps, H)) + '\n' + svg.slice(i)
}
