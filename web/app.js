// app.js -- the proof and its colophon. Every copper word in the colophon is a control,
// and the sentence is rebuilt from the state each time, so it always says what the page
// is (it is the garden's alt text too). The garden comes from worker.js (florilegium-svg.lua under
// wasmoon), the math theme's text from captions.js (MathJax).
// Copyright (c) 2026 Kevin Raymond. MIT License: see LICENSE or florilegium.sty.

import { withCaptions } from './captions.js'

const $ = (s) => document.querySelector(s)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// ---------------------------------------------------------------- the choices
const PAPERS = {
  a4: { name: 'A4', w: 210, h: 297, art: 'an', latex: 'a4paper', typst: 'a4' },
  letter: { name: 'US Letter', w: 215.9, h: 279.4, art: 'a', latex: 'letterpaper', typst: 'us-letter' },
  a5: { name: 'A5', w: 148, h: 210, art: 'an', latex: 'a5paper', typst: 'a5' },
}
const TOP = 32, BOTTOM = 30, INNER = 22, MINTEXT = 60, MINMARGIN = 30     // mm, as florilegium-grow.tex
const INKS = [['Delft blue', '2456C4'], ['teal', '1D6E7A'], ['viridian', '2F6B4F'], ['sepia', '5B2A1F'], ['madder', '8E1B3A'], ['indigo', '4B3B8F']]
const ACCENTS = [['copper', 'B4662F'], ['ochre', 'C9A227'], ['madder', '8E1B3A'], ['cobalt', '2456C4']]
const STYLES = [['flora', 'a flowering plant'], ['geometric', 'a plant cut from flat shapes'], ['math', 'a cascade of figures and equations']]
// each density is a whole phrase, so the sentence reads at every one of them
const DENSITY = [[1, 'at full density'], [0.75, 'at three-quarter density'], [0.5, 'at half density'], [0.25, 'at quarter density'], [0.05, '']]
const SPARSEST = { flora: 'pared down to a single vine', geometric: 'pared down to a single stem', math: 'pared down to a few figures' }
const density = () => DENSITY.map(([v, n]) => [v, v === 0.05 ? SPARSEST[state.style] : n])
const densityWord = (v) => (density().find(([x]) => x === v) || [, `at density ${+(+v).toFixed(2)}`])[1]
const isMath = () => state.style === 'math'                  // figures, not a plant: no season, no visitors
const HEAD = { flora: 'its ivy leaf', geometric: 'its ivy leaf', math: 'the circle that starts it' }
const STRENGTH = [[1, 'full'], [0.7, 'soft'], [0.4, 'faint']]
const MARGINS = [40, 50, 60, 68, 80, 90]
const SEEN = [['', 'most readers'], ['protan', 'protanopia'], ['deutan', 'deuteranopia'], ['tritan', 'tritanopia']]
const TABS = [['latex', 'LaTeX'], ['typst', 'Typst'], ['svg', 'SVG'], ['cli', 'Command line']]
const DEFAULTS = {
  seed: 7, paper: 'a4', margin: 68, side: 'left', season: 'summer', style: 'flora', density: 1, strength: 1,
  ink: '2456C4', accent: 'B4662F', visitors: true, last: false, end: 45, head: true, seen: '', tab: 'latex',
}
const state = { ...DEFAULTS }

const paper = () => PAPERS[state.paper]
const maxMargin = () => Math.min(100, Math.floor(paper().w - INNER - MINTEXT))
const clampMargin = (m) => Math.max(MINMARGIN, Math.min(maxMargin(), Math.round(m)))
const endMM = () => Math.round((paper().h - TOP - BOTTOM) * state.end / 100)
const named = (hex, list) => (list.find(([, h]) => h === hex) || [`#${hex.toLowerCase()}`])[0]
const word = (v, list) => (list.find(([x]) => x === v) || [, String(v)])[1]
const styleName = () => word(state.style, STYLES)

// ---------------------------------------------------------------- state and the address bar
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1))
  for (const [k, d] of Object.entries(DEFAULTS)) {
    if (!p.has(k)) continue
    const v = p.get(k)
    if (typeof d === 'number') { const n = Number(v); if (isFinite(n)) state[k] = n }
    else if (typeof d === 'boolean') state[k] = v === '1'
    else if (/^[\w-]*$/.test(v)) state[k] = v
  }
  if (!PAPERS[state.paper]) state.paper = 'a4'
  for (const k of ['ink', 'accent']) if (!/^[0-9A-F]{6}$/.test(state[k] = state[k].toUpperCase())) state[k] = DEFAULTS[k]
  if (!['left', 'right'].includes(state.side)) state.side = 'left'
  if (!['spring', 'summer', 'autumn'].includes(state.season)) state.season = 'summer'
  if (!STYLES.some(([s]) => s === state.style)) state.style = 'flora'
  if (!SEEN.some(([s]) => s === state.seen)) state.seen = ''
  if (!TABS.some(([s]) => s === state.tab)) state.tab = 'latex'
  state.seed = Math.max(1, Math.min(999999, Math.round(state.seed) || 1))
  state.margin = clampMargin(state.margin)
  state.density = Math.max(0.05, Math.min(1, state.density))
  state.strength = Math.max(0.1, Math.min(1, state.strength))
  state.end = Math.max(10, Math.min(95, Math.round(state.end)))
}
function writeHash() {
  const p = new URLSearchParams()
  for (const [k, d] of Object.entries(DEFAULTS)) {
    if (k === 'seed' || state[k] !== d) p.set(k, typeof d === 'boolean' ? (state[k] ? '1' : '0') : state[k])
  }
  history.replaceState(null, '', '#' + p.toString())
}

// what florilegium-svg.lua gets
function options(seed = state.seed) {
  const o = {
    seed, paper: state.paper, density: state.density, intensity: state.strength, ink: state.ink, accent: state.accent,
    visitors: state.visitors, head: state.head,
    left: (state.side === 'left' ? state.margin : INNER) + 'mm', right: (state.side === 'left' ? INNER : state.margin) + 'mm',
  }
  if (state.season !== 'summer' && !isMath()) o.season = state.season
  if (isMath()) o.visitors = true
  if (state.style !== 'flora') o.theme = state.style
  if (state.last) o.textend = endMM() + 'mm'
  return o
}

// ---------------------------------------------------------------- the colophon
const term = (k, text) => `<button class="term" data-k="${k}" aria-haspopup="listbox" aria-expanded="false">${esc(text)}</button>`
function colophon() {
  const s = state, P = paper()
  const what = isMath() ? 'figures' : 'garden'
  // a seed that no visitor came to says so, or the switch would seem to do nothing
  const counts = current && current.stats && current.stats.counts
  const none = counts && !VISITORS.some((k) => counts[k] > 0) ? ', though none came to this seed' : ''
  return `This proof is ${P.art} ${term('paper', P.name)} page, its ${what} in a ${term('margin', s.margin + ' mm')} margin on the
    ${term('side', s.side)}. It grew from seed <span class="nowrap"><button class="stepper" data-step="-1" aria-label="Previous seed">‹</button>${term('seed', s.seed)}<button class="stepper" data-step="1" aria-label="Next seed">›</button></span>
    ${isMath() ? '' : `in ${term('season', s.season)}, `}as ${term('style', styleName())} ${term('density', densityWord(s.density))}, and it is
    printed at ${term('strength', word(s.strength, STRENGTH))} strength in ${term('ink', named(s.ink, INKS))} with ${term('accent', named(s.accent, ACCENTS))}.
    ${isMath() ? '' : term('visitors', s.visitors ? 'Visitors are welcome' : 'No visitors come') + (s.visitors ? none : '') + '.'}
    The text ${term('last', s.last ? `ends ${s.end}% of the way down` : 'runs the full page')}${s.last ? `, and the ${isMath() ? 'figures fill' : 'garden grows into'} the space below it` : ''}.`
}
function plain(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/[‹›]/g, '').replace(/\s+/g, ' ').trim() }

// what each word offers: [value, label, note?]
function choices(k) {
  const s = state
  switch (k) {
    case 'paper': return Object.entries(PAPERS).map(([v, p]) => [v, p.name])
    case 'margin': return MARGINS.filter((m) => m <= maxMargin()).map((m) => [m, m + ' mm'])
    case 'side': return [['left', 'left'], ['right', 'right']]
    case 'season': return [['spring', 'spring'], ['summer', 'summer'], ['autumn', 'autumn']]
    case 'style': return STYLES
    case 'density': return density()
    case 'strength': return STRENGTH
    case 'ink': return INKS.map(([n, h]) => [h, n, weakNote(h, s.accent, named(s.accent, ACCENTS))])
    case 'accent': return ACCENTS.map(([n, h]) => [h, n, weakNote(s.ink, h, named(s.ink, INKS))])
    case 'visitors': return [[true, 'Visitors are welcome'], [false, 'No visitors come']]
    case 'last': return [[false, 'runs the full page'], [true, 'ends partway down']]
    case 'head': return [[true, 'keeps'], [false, 'leaves out']]
  }
  return []
}
const HINTS = {
  margin: () => `or drag the knob above the proof, anywhere from ${MINMARGIN} to ${maxMargin()} mm`,
  last: () => 'or drag the foot of the text on the proof',
}

// every change comes through here
function set(k, v, now) {
  if (k === 'paper') { state.paper = v; state.margin = clampMargin(state.margin) }
  else if (k === 'last') { state.last = v; if (v && state.end > 90) state.end = 45 }
  else state[k] = v
  refresh()
  if (k === 'seen' || k === 'tab') { $(`[data-${k}="${v}"]`)?.focus(); return }
  forget()
  layout()
  pageText(current)
  now ? render() : soon()
}

// ---------------------------------------------------------------- the chooser
const chooser = $('#chooser')
let openTerm = null
function openChooser(t) {
  const k = t.dataset.k
  if (openTerm && openTerm.dataset.k === k) return closeChooser(true)
  closeChooser()
  openTerm = t
  t.setAttribute('aria-expanded', 'true')
  chooser.innerHTML = ''
  if (k === 'seed') {
    chooser.innerHTML = `<form><input type="number" min="1" max="999999" value="${esc(state.seed)}" aria-label="Seed"><button class="term" type="submit">grow it</button></form>
      <button role="option" data-v="random"><span class="mark"></span><span>a seed at random</span></button>`
    chooser.querySelector('form').onsubmit = (e) => { e.preventDefault(); pick('seed', Math.max(1, Math.min(999999, Math.round(+e.target[0].value) || 1))) }
    chooser.querySelector('[data-v=random]').onclick = () => pick('seed', 1 + Math.floor(Math.random() * 99999))
  } else {
    for (const [v, label, note] of choices(k)) {
      const b = document.createElement('button')
      b.setAttribute('role', 'option')
      const on = v === state[k]
      b.setAttribute('aria-selected', String(on))
      const ramp = (k === 'ink' || k === 'accent') ? `<span class="ramp" style="background:${rampCSS(v)}"></span>` : ''
      b.innerHTML = `<span class="mark">${on ? '☞' : ''}</span><span>${ramp}${esc(label)}</span>` + (note ? `<small>${esc(note)}</small>` : '')
      b.onclick = () => pick(k, v)
      chooser.appendChild(b)
    }
    if (k === 'ink' || k === 'accent') {
      const b = document.createElement('button')
      b.setAttribute('role', 'option')
      const custom = !choices(k).some(([v]) => v === state[k])
      b.innerHTML = `<span class="mark">${custom ? '☞' : ''}</span><span><span class="ramp" style="background:linear-gradient(90deg, #2456c4, #1d6e7a, #c9a227, #b4662f, #8e1b3a, #4b3b8f)"></span>any color…</span>`
      b.onclick = () => { const p = $('#picker'); p.dataset.k = k; p.value = '#' + state[k].toLowerCase(); closeChooser(); p.click() }
      chooser.appendChild(b)
    } else if (HINTS[k]) {
      const h = document.createElement('p')
      h.className = 'hint'
      h.textContent = HINTS[k]()
      chooser.appendChild(h)
    }
  }
  chooser.hidden = false
  const r = t.getBoundingClientRect()
  chooser.style.left = Math.max(8, Math.min(scrollX + r.left - 10, scrollX + innerWidth - chooser.offsetWidth - 12)) + 'px'
  chooser.style.top = (scrollY + r.bottom + 6) + 'px'
  ;(chooser.querySelector('input') || chooser.querySelector('[aria-selected=true]') || chooser.querySelector('[role=option]'))?.focus()
}
function closeChooser(focusBack) {
  if (!openTerm) return
  const k = openTerm.dataset.k
  openTerm.setAttribute('aria-expanded', 'false')
  openTerm = null
  chooser.hidden = true
  if (focusBack) $(`.term[data-k=${k}]`)?.focus()
}
function pick(k, v) {
  closeChooser()
  set(k, v, true)
  $(`.term[data-k=${k}]`)?.focus()
}
$('#picker').addEventListener('input', (e) => set(e.target.dataset.k, e.target.value.slice(1).toUpperCase()))
document.addEventListener('click', (e) => {
  const t = e.target.closest('.term')
  if (t && t.dataset.k && !chooser.contains(t)) { e.stopPropagation(); openChooser(t); return }
  const st = e.target.closest('.stepper')
  if (st) {
    const step = st.dataset.step
    set('seed', Math.max(1, state.seed + +step), true)
    $(`.stepper[data-step="${step}"]`)?.focus()
    return
  }
  if (openTerm && !chooser.contains(e.target)) closeChooser()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#measurements').hidden) closeMeasurements(); else closeChooser(true) }
  if (!openTerm || !chooser.contains(document.activeElement)) return
  const opts = [...chooser.querySelectorAll('[role=option]')]
  const i = opts.indexOf(document.activeElement)
  if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus() }
  if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(0, i - 1)]?.focus() }
  if (e.key === 'Tab') closeChooser()
})

// ---------------------------------------------------------------- color, as others see it
// Machado, Oliveira & Fernandes (2009), severity 1, in linear sRGB; distances in Oklab
// (Björn Ottosson). The same matrices filter the proof under "seen by".
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
const lin = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const rgbLin = (h) => [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255))
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
}
const see = (c, k) => k ? CVD[k].map((row) => Math.max(0, Math.min(1, row[0] * c[0] + row[1] * c[1] + row[2] * c[2]))) : c
function apart(a, b, k) {
  const A = oklab(see(rgbLin(a), k)), B = oklab(see(rgbLin(b), k))
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
}
const WEAK = 0.10, CLEAR = 0.15
const weakest = (ink, acc) => SEEN.slice(1).map(([k, n]) => [apart(ink, acc, k), n]).sort((a, b) => a[0] - b[0])[0]
function weakNote(ink, acc, other) {
  if (ink === acc) return ''
  const [d, who] = weakest(ink, acc)
  return d < WEAK ? `with ${other}, hard to tell apart for ${who}` : ''
}
const rampCSS = (h) => `linear-gradient(90deg, color-mix(in oklab, #${h} 55%, black), #${h}, color-mix(in oklab, #${h} 25%, white))`

function showSeen() {
  $('#proof').style.filter = state.seen ? `url(#${state.seen})` : ''
  const inkN = named(state.ink, INKS), accN = named(state.accent, ACCENTS)
  const cap = (s) => s[0].toUpperCase() + s.slice(1)
  let v
  if (state.seen) {
    const d = apart(state.ink, state.accent, state.seen), who = word(state.seen, SEEN)
    v = `With ${who}, ${inkN} and ${accN} ${d < WEAK ? 'are hard to tell apart' : d < CLEAR ? 'come close' : 'stay apart'} (${d.toFixed(2)}).`
  } else {
    const [d, who] = weakest(state.ink, state.accent)
    v = d < WEAK ? `${cap(inkN)} and ${accN} are hard to tell apart for ${who} (${d.toFixed(2)}).`
      : d < CLEAR ? `${cap(inkN)} and ${accN} come close for ${who} (${d.toFixed(2)}).`
      : `${cap(inkN)} and ${accN} stay apart for all three; the closest is ${who}, at ${d.toFixed(2)}.`
  }
  $('#verdict').innerHTML = esc(v) + ' <button id="mopen">the measurements</button>'
  $('#mopen').onclick = openMeasurements
}
function openMeasurements() {
  const inks = [...INKS], accents = [...ACCENTS]
  if (!INKS.some(([, h]) => h === state.ink)) inks.push([named(state.ink, INKS), state.ink])
  if (!ACCENTS.some(([, h]) => h === state.accent)) accents.push([named(state.accent, ACCENTS), state.accent])
  const rows = ['<tr><th>Ink</th><th>Accent</th>' + SEEN.map(([, n]) => `<th>${n}</th>`).join('') + '</tr>']
  for (const [an, ah] of accents) for (const [n, h] of inks) {
    if (h === ah) continue
    const cur = h === state.ink && ah === state.accent
    rows.push(`<tr${cur ? ' class="current"' : ''}><td>${esc(n)}${cur ? ' ☞' : ''}</td><td>${esc(an)}</td>` +
      SEEN.map(([k]) => { const d = apart(h, ah, k); return `<td${d < WEAK ? ' class="weak"' : ''}>${d.toFixed(3)}</td>` }).join('') + '</tr>')
  }
  $('#mtable').innerHTML = rows.join('')
  $('#measurements').hidden = false
  $('#mclose').focus()
}
function closeMeasurements() { $('#measurements').hidden = true; $('#mopen')?.focus() }
$('#mclose').onclick = closeMeasurements
$('#measurements').onclick = (e) => { if (e.target.id === 'measurements') closeMeasurements() }

// ---------------------------------------------------------------- the proof
// where things are on the page, in cm: from Lua once it has answered for these settings,
// worked out from the settings until then
let geom = null
const forget = () => { if (geom && geom.key !== JSON.stringify(options())) geom = null }
function pageGeom() {
  if (geom) return geom
  const P = paper(), l = state.side === 'left' ? state.margin : INNER, r = state.side === 'left' ? INNER : state.margin
  return { pw: P.w / 10, ph: P.h / 10, x0: l / 10, x1: (P.w - r) / 10, ytop: (P.h - TOP) / 10, ybot: BOTTOM / 10 }
}
const pct = (v) => (v * 100).toFixed(4) + '%'
function layout() {
  const g = pageGeom(), P = paper()
  // the text edge follows the margin while it is dragged
  const x0 = state.side === 'left' ? state.margin / 10 : g.x0, x1 = state.side === 'right' ? (P.w - state.margin) / 10 : g.x1
  $('#sheet').style.setProperty('--ar', (g.pw / g.ph).toFixed(5))
  const full = g.ytop - g.ybot, h = state.last ? full * state.end / 100 : full
  const text = $('#text')
  Object.assign(text.style, { left: pct(x0 / g.pw), width: pct((x1 - x0) / g.pw), top: pct((g.ph - g.ytop) / g.ph), height: pct(h / g.ph) })
  $('#proof').style.setProperty('--fs', (11 / 72.27 * 2.54 / g.pw * 100).toFixed(4) + 'cqw')
  const folio = $('#folio')
  Object.assign(folio.style, { left: text.style.left, width: text.style.width, top: `calc(${pct((g.ph - g.ybot + 1.054) / g.ph)} - 0.9em)` })
  folio.hidden = state.last
  Object.assign($('#foot').style, { left: text.style.left, width: text.style.width, top: pct((g.ph - g.ytop + h) / g.ph) })
  $('#foot-label').textContent = state.last ? `⌄ the text ends here, ${endMM()} mm down` : '⌃ drag up to end the text here'
  $('#foot').setAttribute('aria-valuetext', state.last ? `the text ends ${endMM()} millimeters down` : 'the text runs the full page')
  const m = $('#measure')
  m.className = 'measure ' + state.side
  Object.assign(m.style, state.side === 'left' ? { left: '0%', width: pct(x0 / g.pw) } : { left: pct(x1 / g.pw), width: pct((g.pw - x1) / g.pw) })
  $('#mm').textContent = state.margin + ' mm'
  const k = $('#knob')
  k.setAttribute('aria-valuenow', state.margin)
  k.setAttribute('aria-valuemax', maxMargin())
  k.setAttribute('aria-valuetext', state.margin + ' millimeters')
  fit()
}
// on a last page the text stops at the end of a paragraph, as it would
function fit() {
  const text = $('#text')
  for (const p of text.querySelectorAll('p')) p.hidden = false
  if (!state.last) return
  for (const p of text.querySelectorAll('p')) if (p.offsetTop + p.offsetHeight > text.clientHeight + 1) p.hidden = true
}
new ResizeObserver(() => fit()).observe($('#sheet'))

// the knob on the measure sets the margin; the foot of the text sets where it ends
function drag(el, move) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); forget(); render() }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  })
}
drag($('#knob'), (e) => {
  const r = $('#sheet').getBoundingClientRect(), x = (e.clientX - r.left) / r.width * paper().w
  state.margin = clampMargin(state.side === 'left' ? x : paper().w - x)
  layout(); refresh(true)
})
$('#knob').addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 5 : 1, dir = state.side === 'left' ? 1 : -1
  const d = { ArrowRight: step * dir, ArrowLeft: -step * dir, ArrowUp: step, ArrowDown: -step }[e.key]
  if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); set('margin', e.key === 'Home' ? MINMARGIN : maxMargin()); $('#knob').focus(); return }
  if (d) { e.preventDefault(); state.margin = clampMargin(state.margin + d); forget(); layout(); refresh(true); soon() }
})
drag($('#foot'), (e) => {
  const g = pageGeom(), r = $('#sheet').getBoundingClientRect()
  const top = r.top + (g.ph - g.ytop) / g.ph * r.height, full = (g.ytop - g.ybot) / g.ph * r.height
  const p = Math.round((e.clientY - top) / full * 100)
  state.last = p < 96
  if (state.last) state.end = Math.max(10, Math.min(95, p))
  layout(); refresh(true)
})
$('#foot').addEventListener('keydown', (e) => {
  const d = { ArrowUp: -2, ArrowDown: 2 }[e.key]
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set('last', !state.last, true); $('#foot').focus(); return }
  if (d) {
    e.preventDefault()
    if (!state.last) { if (d < 0) { state.last = true; state.end = 94 } }
    else { state.end += d; if (state.end >= 96) { state.last = false; state.end = 45 } else state.end = Math.max(10, state.end) }
    forget(); layout(); refresh(true); soon()
  }
})

// ---------------------------------------------------------------- the page describes its own garden
const ONES = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const say = (n) => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n)
const upper = (s) => s[0].toUpperCase() + s.slice(1)
const NAMES = {
  flower: ['flower', 'flowers'], lily: ['lily', 'lilies'], blossoms: ['spray of blossom', 'sprays of blossom'],
  cyme: ['cyme of forget-me-nots', 'cymes of forget-me-nots'], sprig: ['sprig', 'sprigs'], umbel: ['umbel', 'umbels'],
  leaf: ['leaf on a stalk of its own', 'leaves on stalks of their own'], bud: ['bud', 'buds'], bells: ['stem of bells', 'stems of bells'],
  tendril: ['tendril', 'tendrils'], budding: ['budding stem', 'budding stems'], seedhead: ['seed head', 'seed heads'],
  crystal: ['crystal', 'crystals'], butterfly: ['butterfly', 'butterflies'], bee: ['bee', 'bees'], snail: ['snail', 'snails'], bird: ['bird', 'birds'],
}
const VISITORS = ['butterfly', 'bee', 'snail', 'bird']
const count = (n, name) => `${n === 1 ? (/^[aeiou]/.test(NAMES[name][0]) ? 'an' : 'a') : say(n)} ${NAMES[name][n === 1 ? 0 : 1]}`
const list = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]

function pageText(m) {
  const s = state, inkN = named(s.ink, INKS), accN = named(s.accent, ACCENTS)
  const counts = (m && m.stats && m.stats.counts) || {}
  const P = []
  if (s.style === 'math') {
    const n = (m && m.captions && m.captions.length) || 0
    P.push(`This margin is not a plant. Figures cascade down the column, one or two families of them growing larger
      toward the corner, each joined to the next by a copper arrow, and a large figure stands where the column meets the foot.`)
    if (n) P.push(`${upper(say(n))} symbols and equations fill the space that is left and run along the foot of the page, tilted a little,
      in the tones of ${inkN} and in ${accN}. In a PDF TeX sets them; here MathJax does, in the same Computer Modern.`)
  } else {
    const stems = s.density >= 0.6 ? 3 : s.density >= 0.25 ? 2 : 1
    P.push(`This margin was grown, not drawn. ${upper(say(stems))} stem${stems > 1 ? 's' : ''} rose from a root in the lower corner of the margin.
      ${stems > 1 ? `The tallest reached the head of the page and opened the largest flower there; the other${stems > 2 ? 's stopped at about two thirds and two fifths' : ' stopped at about two thirds'} of the height.` : 'It climbed to the head of the page and opened a flower there.'}`)
    const grown = Object.keys(NAMES).filter((k) => !VISITORS.includes(k) && counts[k] > 0)
    const branches = grown.reduce((a, k) => a + counts[k], 0)
    if (m && m.stats && branches) {
      P.push(`Then the program looked for room. ${upper(say(branches))} times it found the largest empty space within reach of a stem, chose
        something that would fit there, scaled it to the space and grew a branch out to it: ${list(grown.map((k) => count(counts[k], k)))}.
        Each branch became stem in its turn, so the next could start from it, and ${m.stats.stems} points of stem now hold the garden together.`)
    }
    const came = VISITORS.filter((k) => counts[k] > 0)
    P.push(!s.visitors ? 'Visitors were asked to stay away: no butterflies, bees, snails or birds.'
      : came.length ? `${upper(list(came.map((k) => count(counts[k], k))))} came to visit; another seed brings others, or none.`
      : 'No visitors came to this page. On another seed a butterfly crosses the margin, a bee works the flowers, or a snail climbs a stem; nothing here decides that but the seed.')
    P.push(s.season === 'summer' ? 'It is summer, and everything is in flower.'
      : s.season === 'spring' ? `It is spring. The shorter stems end in buds${counts.budding ? `, ${count(counts.budding, 'budding')} ${counts.budding === 1 ? 'opens' : 'open'} among them` : ''}, and the young leaves come small and pale.`
      : `It is autumn. ${counts.seedhead ? `${upper(count(counts.seedhead, 'seedhead'))} ${counts.seedhead === 1 ? 'stands' : 'stand'} where flowers were, and s` : 'S'}ome leaves have turned ${accN}; petals lie below the blooms that dropped them.`)
    if (s.style === 'geometric') {
      P.push(`The plant is cut from flat shapes: the stems run straight and turn at mitered corners, the leaves are kites in a light
        and a dark facet, and the flowers are stars${counts.crystal ? `, with ${count(counts.crystal, 'crystal')} among them` : ''}.`)
    }
  }
  P.push(`Every ${s.style === 'flora' ? 'petal' : 'line'} is computed while the page is written and painted in ${s.style === 'flora' ? 'washes' : 'tones'} of one ink, ${inkN},
    from its darkest to its palest, the way a single pigment thins with water. The ${accN} is the only other color on the page; it marks
    ${isMath() ? 'the head rule, the arrows from figure to figure and some of the symbols' : 'the head rule, the hairlines and, in autumn, the turning leaves'}.`)
  if (s.density < 1 || s.strength < 1) {
    P.push([s.density < 1 ? `It is grown ${densityWord(s.density)}, so there is less of everything and more paper between.` : '',
      s.strength < 1 ? `It is printed at ${word(s.strength, STRENGTH)} strength: every tone moves toward the paper, and the detail stays.` : ''].join(' '))
  }
  P.push(`Change a copper word in the colophon beside this page and the margin grows again. Drag the measure above the page to give
    it more room or less, or drag the foot of this text up to make this the last page, and the margin fills the space the text leaves.`)
  P.push(`Seed ${s.seed} here is seed ${s.seed} in a PDF. The same Lua runs in this page as in LuaLaTeX, and the SVG you download is the
    drawing LuaLaTeX would make${s.style === 'math' ? ', its equations set by MathJax instead of TeX' : ''}.`)
  if (s.style !== 'math') {
    P.push(`How does it know where there is room? The margin is laid over a grid of two-millimeter cells, and each cell keeps the
      radius of the largest disc that would fit there without touching anything already grown. A new branch looks only within
      three centimeters of a stem, and the loop stops when the largest free disc is under four millimeters across; what is left
      goes to leaflets and florets, or stays paper.`)
    P.push(`The idea is older than the program. Michael Wong, Douglas Zongker and David Salesin described it in 1998: grow toward
      the largest free space, place what fits there, and repeat, so that the ornament fills the page the way a plant fills a wall.
      Everything here is drawn in a different way, but the loop that decides where things go is theirs.`)
  }
  P.push(`The margin is measured, not guessed. It is read from the page as TeX lays it out, so what grows for this page fits it to
    the millimeter, and on the right-hand page of a two-sided book it grows as well in the right margin, mirrored.`)
  P.push(isMath()
    ? `Nothing on this page is a stored picture. Every figure is computed from its formula while the page is written: Maurer's roses,
      Lissajous figures, Koch's snowflake, Hilbert's curve, the Petersen graph, Vogel's sunflower, and the seed chooses which, where and how large.`
    : `Nothing on this page is a picture of a flower. There are no stored shapes and no drawings to copy: every stem is a path along
      a noisy curve, every leaf a blade around its spine, every flower a ring of petals each a little different from the last, and the seed chooses all of it.`)
  P.push(`Every page of a long document grows its own margin, from its own seed and fitted to its own space${isMath() ? '' : ', and the seasons can turn from the first page to the last'}.`)
  $('#text').innerHTML = `<h2><span>1</span>Seed ${esc(s.seed)}</h2>` + P.map((p) => `<p>${esc(p.replace(/\s+/g, ' ').trim())}</p>`).join('')
  fit()
}

// ---------------------------------------------------------------- the snippets
// Set in lines that fit the box (40 characters; the first sits beside "copy"), broken
// where the language allows: at a comma in LaTeX and Typst, with a backslash in the shell.
const fmt = (x) => String(+(+x).toFixed(2))
const WIDTH = 40
function wrap(head, items, tail, indent = '  ', glue = ',') {
  const lines = []
  let cur = head
  items.forEach((it, i) => {
    const piece = it + (i < items.length - 1 ? glue : tail)
    const sep = cur === head || cur === indent ? '' : ' '
    if (cur !== head && (cur + sep + piece).length > WIDTH) { lines.push(cur); cur = indent + piece } else cur += sep + piece
  })
  lines.push(cur)
  return lines
}
function snippet() {
  const s = state, P = paper(), left = s.side === 'left' ? s.margin : INNER, right = s.side === 'left' ? INNER : s.margin
  const file = `florilegium-${s.seed}.svg`
  if (s.tab === 'latex') {
    const opts = ['grown']
    if (s.style !== 'flora') opts.push('theme=' + s.style)
    if (s.density < 1) opts.push('density=' + fmt(s.density))
    if (s.strength < 1) opts.push('intensity=' + fmt(s.strength))
    if (!s.visitors && !isMath()) opts.push('novisitors')
    const L = ['\\documentclass[11pt]{article}', `\\usepackage[${P.latex},`, `  left=${left}mm, right=${right}mm, top=${TOP}mm,`,
      `  bottom=${BOTTOM}mm, headsep=8mm]{geometry}`, `\\def\\florilegiumseed{${s.seed}}`, ...wrap('\\usepackage[', opts, ']{florilegium}')]
    if (s.ink !== DEFAULTS.ink) L.push(`\\definecolor{ink}{HTML}{${s.ink}}`)
    if (s.accent !== DEFAULTS.accent) L.push(`\\definecolor{accent}{HTML}{${s.accent}}`)
    if (s.season !== 'summer' && !isMath()) L.push(`\\florilegiumage{${s.season === 'spring' ? 0 : 1}}`)
    L.push('\\begin{document}', '...', ...(s.last ? ['% the margin fills the space below:', '\\florilegiumtextend'] : ['% \\florilegiumtextend at the very end']), '\\end{document}')
    return [L.join('\n'), `Page 1 of this document has this garden, and every page after it grows its own. Build it with lualatex${s.head ? '' : '; LaTeX always draws the head rule'}.`]
  }
  if (s.tab === 'typst') {
    return [['#set page(', `  paper: "${P.typst}",`, `  margin: (left: ${left}mm, right: ${right}mm,`, `    top: ${TOP}mm, bottom: ${BOTTOM}mm),`,
      '  background: image(', `    "${file}",`, '    width: 100%, height: 100%),', ')'].join('\n'),
      'Download the SVG beside your .typ file. Typst puts the same garden on every page; for one per page, make one per page from the command line with --page.']
  }
  if (s.tab === 'svg') {
    const mb = current ? ` ${(current.svg.length / 1e6).toFixed(1)} MB,` : ''
    return [`${file}:${mb} a whole ${P.name} page with a transparent background, the ${isMath() ? 'figures' : 'garden'} in its margin`,
      `For Typst, a web page or your notes. It ${term('head', s.head ? 'keeps' : 'leaves out')} the head rule and ${HEAD[s.style]}.`, true]
  }
  const a = ['texlua florilegium-svg.lua --seed ' + s.seed]
  if (s.paper !== 'a4') a.push('--paper ' + s.paper)
  if (left !== 68 || right !== INNER) a.push(`--left ${left}mm --right ${right}mm`)
  if (s.season !== 'summer' && !isMath()) a.push('--season ' + s.season)
  if (s.style !== 'flora') a.push('--theme ' + s.style)
  if (s.density < 1) a.push('--density ' + fmt(s.density))
  if (s.strength < 1) a.push('--intensity ' + fmt(s.strength))
  if (s.ink !== DEFAULTS.ink) a.push('--ink ' + s.ink)
  if (s.accent !== DEFAULTS.accent) a.push('--accent ' + s.accent)
  if (!s.visitors && !isMath()) a.push('--novisitors')
  if (!s.head) a.push('--nohead')
  if (s.last) a.push(`--textend ${endMM()}mm`)
  a.push('> ' + file)
  return [wrap('', a, '', '  ', '').join(' \\\n'), `From a clone of the repository; any Lua 5.3 or 5.4 runs it in place of texlua.${s.style === 'math' ? ' Without TeX or MathJax the equations are left out.' : ''}`]
}

// ---------------------------------------------------------------- putting it on the page
// the fade at a long snippet's foot: there while there is more below
function fade() { const p = $('#snippet'); p.classList.toggle('more', p.scrollHeight - p.scrollTop - p.clientHeight > 2) }
$('#snippet').addEventListener('scroll', fade)
new ResizeObserver(fade).observe($('#snippet'))
function refresh(light) {
  $('#colophon').innerHTML = colophon()
  $('#garden').alt = plain(colophon())
  if (light) return
  $('#seenby').innerHTML = SEEN.map(([k, n]) => `<button class="opt" data-seen="${k}" aria-pressed="${state.seen === k}">${n}</button>`).join('<span class="sep">·</span>')
  for (const b of document.querySelectorAll('[data-seen]')) b.onclick = () => set('seen', b.dataset.seen)
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button class="opt" role="tab" data-tab="${k}" aria-pressed="${state.tab === k}" aria-selected="${state.tab === k}">${n}</button>`).join('<span class="sep">·</span>')
  for (const b of document.querySelectorAll('[data-tab]')) b.onclick = () => set('tab', b.dataset.tab)
  const [text, note, html] = snippet()
  $('#snippet').textContent = text
  fade()
  $('#note')[html ? 'innerHTML' : 'textContent'] = note
  showSeen()
  writeHash()
}

// ---------------------------------------------------------------- the worker
const worker = new Worker('worker.js')
let ready = false, busy = false, pending = false, seq = 0, current = null, gardenURL = null, timer = null
const soon = () => { clearTimeout(timer); timer = setTimeout(render, 250) }
function status(t, error) { const g = $('#grown'); g.textContent = t; g.classList.toggle('error', !!error) }
worker.onmessage = async (e) => {
  const m = e.data
  if (m.ready) { ready = true; render(); return }
  if (m.id === undefined) { status('The Lua could not start: ' + m.error, true); return }
  busy = false
  if (m.error) { status(m.error, true); $('#proof').classList.remove('growing') }
  else if (m.id === seq && !pending) await show(m)
  if (pending) { pending = false; render() }
}
function render() {
  clearTimeout(timer)
  refresh()
  layout()
  if (!ready) return
  if (busy) { pending = true; return }
  busy = true
  $('#proof').classList.add('growing')
  status('The garden is growing…')
  worker.postMessage({ id: ++seq, options: options() })
}
async function show(m) {
  if (m.captions && m.captions.length) {
    try { m.svg = await withCaptions(m.svg, m.captions) } catch (err) { status(String(err.message || err), true) }
  }
  if (m.id !== seq) return
  current = window.current = m
  geom = { pw: m.pw, ph: m.ph, x0: m.mirror ? m.pw - m.textright : m.textleft, x1: m.mirror ? m.pw - m.textleft : m.textright,
    ytop: m.ytop, ybot: m.ybot, key: JSON.stringify(options()) }
  if (gardenURL) URL.revokeObjectURL(gardenURL)
  gardenURL = URL.createObjectURL(new Blob([m.svg], { type: 'image/svg+xml' }))
  const img = $('#garden')
  img.onload = () => $('#proof').classList.remove('growing')
  img.src = gardenURL
  layout()
  pageText(m)
  refresh()
  $('#download').disabled = false
  const took = m.ms < 950 ? `${Math.max(10, Math.round(m.ms / 10) * 10)} milliseconds` : `${(m.ms / 1000).toFixed(1)} seconds`
  status(`This proof grew in ${took}, here in your browser.`)
}

$('#download').onclick = () => {
  if (!current) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([current.svg], { type: 'image/svg+xml' }))
  a.download = `florilegium-${state.seed}.svg`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
$('#copy').onclick = async (e) => {
  try { await navigator.clipboard.writeText($('#snippet').textContent) } catch { return }
  e.target.textContent = 'copied'
  setTimeout(() => { e.target.textContent = 'copy' }, 1200)
}

window.addEventListener('hashchange', () => { readHash(); forget(); pageText(current); render() })
readHash()
pageText(null)
render()
