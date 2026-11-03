// Operate every control of the playground as a person would, and check what each one did:
// the garden (a hash of its SVG), the page's geometry, the colophon, the address bar and the
// snippets. Serve the repository first (make playground), then:
//   cd tools/playcheck && npm install && node check.mjs [http://localhost:8000/web/] [out-dir]
// CHROME=/path/to/chrome if it is not /usr/bin/chromium. The out-dir gets combined.svg and the
// command-line and LaTeX snippets for one page with every setting changed: run that command
// line and compare (cmp), compile that LaTeX and find the garden in the PDF.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:8000/web/', OUT = process.argv[3] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
// everything the page fetches from another origin; only the files pinned with a hash in
// web/*.js may be (the worker's own fetches don't show here: it checks wasmoon's hashes itself)
const offsite = new Set()
page.on('request', (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.origin !== new URL(BASE).origin) offsite.add(r.url()) })
const web = new URL('../../web/', import.meta.url)
const pinned = new Set(fs.readdirSync(web).filter((f) => f.endsWith('.js'))
  .flatMap((f) => [...fs.readFileSync(new URL(f, web), 'utf8').matchAll(/\['(https:[^']+)', 'sha384-[^']+'\]/g)].map((m) => m[1])))
const results = []
const check = (name, ok, detail = '') => { results.push([ok ? 'pass' : 'FAIL', name, detail]) }

const info = () => page.evaluate(async () => {
  const c = window.current
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(c.svg))
  return { id: c.id, sha: [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join(''), pw: c.pw, ph: c.ph,
    textleft: c.textleft, textright: c.textright, mirror: c.mirror, caps: (c.captions || []).length, paths: (c.svg.match(/<path/g) || []).length,
    bytes: c.svg.length, colophon: document.querySelector('#colophon').textContent.replace(/\s+/g, ' ').trim(),
    hash: location.hash, snippet: document.querySelector('#snippet').textContent, note: document.querySelector('#note').textContent,
    text: document.querySelector('#text').textContent, mm: document.querySelector('#mm').textContent,
    foot: document.querySelector('#foot-label').textContent, filter: document.querySelector('#proof').style.filter,
    status: document.querySelector('#grown').textContent }
})
async function grown(before) {
  try {
    await page.waitForFunction((id) => window.current && window.current.id !== id && !document.querySelector('#proof').classList.contains('growing'), { timeout: 20000 }, before)
  } catch (e) {
    const st = await page.evaluate(() => ({ hash: location.hash, growing: document.querySelector('#proof').classList.contains('growing'), status: document.querySelector('#grown').textContent, chooser: !document.querySelector('#chooser').hidden }))
    check('(no new garden appeared)', false, JSON.stringify(st))
  }
  await new Promise((r) => setTimeout(r, 150))
  return info()
}
async function choose(k, label) {
  const before = (await info()).id
  await page.click(`.term[data-k=${k}]`)
  await page.waitForSelector('#chooser:not([hidden])')
  const ok = await page.evaluate((label) => {
    const b = [...document.querySelectorAll('#chooser [role=option]')].find((o) => o.textContent.replace('☞', '').trim().startsWith(label))
    if (b) b.click()
    return !!b
  }, label)
  if (!ok) throw new Error(`no option "${label}" for ${k}`)
  return grown(before)
}
async function tab(t) { await page.click(`[data-tab=${t}]`); await new Promise((r) => setTimeout(r, 100)); return info() }

await page.goto(BASE + '#seed=7', { waitUntil: 'load' })
await page.waitForFunction(() => window.current && /grew in/.test(document.querySelector('#grown').textContent), { timeout: 60000 })
const base = await info()
check('first garden', base.paths > 1000 && /seed ‹?7/.test(base.colophon), `${base.paths} paths, ${base.status}`)
check('page text from what grew', /Fifty-six times/.test(base.text) && /529 points of stem/.test(base.text), base.text.slice(150, 260) + '…')

// paper
let s = await choose('paper', 'US Letter')
check('paper: US Letter', Math.abs(s.pw - 21.59) < 0.01 && Math.abs(s.ph - 27.94) < 0.01 && /a US Letter page/.test(s.colophon) && /paper=letter/.test(s.hash) && /letterpaper/.test(s.snippet), `${s.pw.toFixed(2)} x ${s.ph.toFixed(2)} cm`)
s = await choose('paper', 'A5')
check('paper: A5 (margin clamped to fit)', Math.abs(s.pw - 14.8) < 0.01 && /66 mm/.test(s.colophon) && /a5paper/.test(s.snippet) && /left=66mm/.test(s.snippet), `${s.pw} cm wide, ${s.mm}`)
s = await choose('paper', 'A4')
s = await choose('margin', '68 mm')
check('paper: back to A4, 68 mm', s.sha === base.sha, s.sha + ' vs ' + base.sha)

// margin
s = await choose('margin', '50 mm')
check('margin: chooser 50 mm', Math.abs(s.textleft - 5.0) < 0.01 && s.mm === '50 mm' && /left=50mm/.test(s.snippet) && /margin=50/.test(s.hash), `text starts at ${s.textleft.toFixed(2)} cm`)
{
  const before = s.id
  const k = await page.$eval('#knob', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })
  const sheet = await page.$eval('#sheet', (e) => { const r = e.getBoundingClientRect(); return [r.x, r.width] })
  await page.mouse.move(k[0], k[1]); await page.mouse.down()
  await page.mouse.move(sheet[0] + sheet[1] * 80 / 210, k[1], { steps: 8 }); await page.mouse.up()
  s = await grown(before)
  check('margin: drag the knob to 80 mm', Math.abs(s.textleft - 8.0) < 0.15 && /8\d mm|79 mm/.test(s.mm), `${s.mm}, text at ${s.textleft.toFixed(2)} cm`)
}
{
  const before = s.id, was = parseInt(s.mm)
  await page.focus('#knob')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
  s = await grown(before)
  check('margin: arrow keys on the knob', parseInt(s.mm) === was - 3, `${was} -> ${s.mm}`)
}
s = await choose('margin', '68 mm')

// side
s = await choose('side', 'right')
check('side: right (mirrored)', s.mirror === true && /on the right/.test(s.colophon) && /left=22mm, right=68mm/.test(s.snippet), `mirror ${s.mirror}`)
s = await choose('side', 'left')
check('side: back to left', s.sha === base.sha && !s.mirror)

// seed
{
  let before = s.id
  await page.click('.stepper[data-step="1"]'); s = await grown(before)
  check('seed: next', /seed ‹?8/.test(s.colophon) && s.sha !== base.sha && /seed=8/.test(s.hash), s.sha)
  before = s.id
  await page.click('.stepper[data-step="-1"]'); s = await grown(before)
  check('seed: previous, same garden again', s.sha === base.sha, 'deterministic')
  before = s.id
  await page.click('.term[data-k=seed]'); await page.waitForSelector('#chooser input')
  await page.$eval('#chooser input', (e) => { e.value = '' }); await page.type('#chooser input', '12'); await page.keyboard.press('Enter')
  s = await grown(before)
  check('seed: typed 12', /seed=12/.test(s.hash) && /\\def\\florilegiumseed\{12\}/.test(s.snippet))
  s = await choose('seed', 'a seed at random')
  check('seed: at random', !/seed=12&|seed=12$/.test(s.hash), s.hash.slice(0, 20))
  check('only one worker grows gardens', (await page.evaluate(() => performance.getEntriesByName(new URL('worker.js', location.href).href).length)) === 1)
  before = s.id
  await page.click('.term[data-k=seed]'); await page.waitForSelector('#chooser input')
  await page.$eval('#chooser input', (e) => { e.value = '' }); await page.type('#chooser input', '7'); await page.keyboard.press('Enter')
  s = await grown(before)
}

// season
s = await choose('season', 'spring')
check('season: spring', s.sha !== base.sha && /It is spring/.test(s.text) && /florilegiumage\{0\}/.test(s.snippet))
s = await choose('season', 'autumn')
check('season: autumn', s.sha !== base.sha && /It is autumn/.test(s.text) && /florilegiumage\{1\}/.test(s.snippet), s.text.match(/It is autumn[^.]*\./)?.[0])
s = await choose('season', 'summer')
check('season: summer again', s.sha === base.sha)

// style
s = await choose('style', 'a plant cut from flat shapes')
check('style: geometric', s.sha !== base.sha && /theme=geometric/.test(s.snippet) && /cut from flat shapes/.test(s.text))
check('seed 7 says no visitors came', /Visitors are welcome, though none came to this seed/.test(base.colophon))
s = await choose('style', 'a plant cut from flat shapes')
const sparseGeo = await page.evaluate(() => { document.querySelector('.term[data-k=density]').click(); return document.querySelector('#chooser').textContent })
await page.keyboard.press('Escape')
check('geometric: the sparsest density is a single stem', /a single stem/.test(sparseGeo) && !/a single vine/.test(sparseGeo))
s = await choose('season', 'autumn')
s = await choose('style', 'a cascade of figures')
check('style: math, its equations set by MathJax', s.caps > 0 && /theme=math/.test(s.snippet) && /florilegium-captions/.test(await page.evaluate(() => window.current.svg)), `${s.caps} symbols and equations`)
{
  const terms = await page.$$eval('#colophon .term', (t) => t.map((x) => x.dataset.k))
  check('math: no season and no visitors in the colophon', !terms.includes('season') && !terms.includes('visitors') && !/summer|autumn|isitors/.test(s.colophon), s.colophon.slice(0, 160))
  check('math: the snippets leave out what it ignores', !/florilegiumage|novisitors/.test(s.snippet), 'autumn was set before switching')
  const sparse = await page.evaluate(() => { document.querySelector('.term[data-k=density]').click(); return document.querySelector('#chooser').textContent })
  await page.keyboard.press('Escape')
  check('math: the sparsest density is a few figures', /a few figures/.test(sparse) && !/vine|stem/.test(sparse))
  const n2 = await tab('svg')
  check('math: the head rule note names its circle', /the head rule and the circle that starts it/.test(n2.note) && !/ivy/.test(n2.note), n2.note)
  const c2 = await tab('cli')
  check('math: the command line too', !/--season|--novisitors/.test(c2.snippet), c2.snippet)
  await tab('latex')
}
s = await choose('style', 'a flowering plant')
check('flora: the season comes back as it was', /in autumn/.test(s.colophon) && /florilegiumage\{1\}/.test(s.snippet))
s = await choose('season', 'summer')

// density, strength
s = await choose('density', 'at half density')
check('density: half', s.paths < base.paths * 0.85 && /density=0.5/.test(s.snippet), `${s.paths} paths (full: ${base.paths})`)
s = await choose('density', 'pared down to a single vine')
check('density: a single vine', s.paths < base.paths * 0.3 && /as a flowering plant pared down to a single vine, and/.test(s.colophon) && /It is grown pared down to a single vine/.test(s.text), `${s.paths} paths`)
s = await choose('density', 'at full density')
s = await choose('strength', 'faint')
check('strength: faint', s.sha !== base.sha && s.paths === base.paths && /intensity=0.4/.test(s.snippet), 'same paths, paler colors')
s = await choose('strength', 'full')

// inks
s = await choose('ink', 'teal')
check('ink: teal', s.sha !== base.sha && /\\definecolor\{ink\}\{HTML\}\{1D6E7A\}/.test(s.snippet) && /in teal/.test(s.colophon))
const viridianNote = await page.evaluate(() => { document.querySelector('.term[data-k=ink]').click(); return document.querySelector('#chooser').textContent })
await page.keyboard.press('Escape')
check('ink: viridian warns about copper', /viridian\s*with copper, hard to tell apart for protanopia/.test(viridianNote))
s = await choose('accent', 'ochre')
check('accent: ochre', s.sha !== base.sha && /\\definecolor\{accent\}\{HTML\}\{C9A227\}/.test(s.snippet) && /with ochre/.test(s.colophon))
{
  const before = s.id
  await page.$eval('#picker', (p) => { p.dataset.k = 'ink'; p.value = '#7a2e5c'; p.dispatchEvent(new Event('input')) })
  s = await grown(before)
  check('ink: any color (the picker)', /#7a2e5c/.test(s.colophon) && /\{7A2E5C\}/.test(s.snippet))
}
s = await choose('ink', 'Delft blue'); s = await choose('accent', 'copper')
check('inks: back to Delft blue and copper', s.sha === base.sha)

// visitors (seed 12 has two bees and a bird)
{
  let before = s.id
  await page.click('.term[data-k=seed]'); await page.waitForSelector('#chooser input')
  await page.$eval('#chooser input', (e) => { e.value = '' }); await page.type('#chooser input', '12'); await page.keyboard.press('Enter')
  const v12 = await grown(before)
  s = await choose('visitors', 'No visitors come')
  check('visitors: none', s.sha !== v12.sha && /novisitors/.test(s.snippet) && /asked to stay away/.test(s.text) && /came to visit/.test(v12.text), v12.text.match(/[^.]*came to visit/)?.[0])
  s = await choose('visitors', 'Visitors are welcome')
  check('visitors: welcome again', s.sha === v12.sha)
  before = s.id
  await page.click('.term[data-k=seed]'); await page.waitForSelector('#chooser input')
  await page.$eval('#chooser input', (e) => { e.value = '' }); await page.type('#chooser input', '7'); await page.keyboard.press('Enter')
  s = await grown(before)
}

// the last page
s = await choose('last', 'ends partway down')
check('last page: chooser', s.sha !== base.sha && /\\florilegiumtextend/.test(s.snippet) && /ends 45% of the way down/.test(s.colophon) && /the text ends here/.test(s.foot), s.foot)
{
  const before = s.id
  const f = await page.$eval('#foot', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width * 0.3, r.y + r.height / 2] })
  const t = await page.$eval('#text', (e) => { const r = e.getBoundingClientRect(); return [r.y] })
  const sheet = await page.$eval('#sheet', (e) => e.getBoundingClientRect().height)
  await page.mouse.move(f[0], f[1]); await page.mouse.down()
  await page.mouse.move(f[0], t[0] + sheet * (23.5 / 29.7) * 0.30, { steps: 8 }); await page.mouse.up()
  s = await grown(before)
  check('last page: drag the foot to 30%', /ends (2[89]|3[012])% of the way down/.test(s.colophon), s.colophon.match(/ends \d+%/)?.[0])
  const hidden = await page.evaluate(() => [...document.querySelectorAll('#text p')].filter((p) => p.hidden).length)
  check('last page: the text stops at a paragraph', hidden > 0, `${hidden} paragraphs held over`)
}
s = await choose('last', 'runs the full page')
check('last page: full page again', s.sha === base.sha)

// the head rule (SVG only), from the SVG tab
await tab('svg')
s = await info()
check('tab: SVG', /a whole A4 page/.test(s.snippet))
{
  const before = s.id
  await page.click('#note .term[data-k=head]'); await page.waitForSelector('#chooser:not([hidden])')
  await page.evaluate(() => [...document.querySelectorAll('#chooser [role=option]')].find((o) => /leaves out/.test(o.textContent)).click())
  s = await grown(before)
  check('head rule: left out', s.sha !== base.sha && /head=0/.test(s.hash))
  const t2 = await tab('cli')
  check('tab: command line', /--nohead/.test(t2.snippet), t2.snippet)
  await tab('svg')
  const b2 = s.id
  await page.click('#note .term[data-k=head]'); await page.waitForSelector('#chooser:not([hidden])')
  await page.evaluate(() => [...document.querySelectorAll('#chooser [role=option]')].find((o) => /keeps/.test(o.textContent)).click())
  s = await grown(b2)
  check('head rule: kept again', s.sha === base.sha)
}
s = await tab('typst')
check('tab: Typst', /#set page\(\n  paper: "a4",/.test(s.snippet) && /florilegium-7\.svg/.test(s.snippet))
s = await tab('latex')
check('tab: LaTeX', /\\usepackage\[grown\]\{florilegium\}/.test(s.snippet))

// seen by
await page.click('[data-seen=protan]'); s = await info()
check('seen by: protanopia', s.filter === 'url("#protan")' && /With protanopia, Delft blue and copper stay apart/.test(await page.$eval('#verdict', (e) => e.textContent)))
await page.click('#mopen')
const rows = await page.$$eval('#mtable tr', (r) => r.length)
const weak = await page.$$eval('#mtable td.weak', (r) => r.length)
check('the measurements', rows > 20 && !(await page.$eval('#measurements', (e) => e.hidden)), `${rows - 1} pairs, ${weak} readings under 0.10`)
await page.keyboard.press('Escape')
await page.click('[data-seen=""]')

// the address bar brings a garden back
{
  const states = '#seed=12&paper=letter&margin=60&side=right&season=autumn&style=geometric&density=0.75&strength=0.7&ink=1D6E7A&accent=C9A227&visitors=0&last=1&end=50&head=0&tab=cli'
  const p2 = await browser.newPage(); await p2.setViewport({ width: 1440, height: 900 })
  await p2.goto(BASE + states, { waitUntil: 'load' })
  await p2.waitForFunction(() => window.current && /grew in/.test(document.querySelector('#grown').textContent), { timeout: 60000 })
  const r = await p2.evaluate(() => ({ svg: window.current.svg, cli: document.querySelector('#snippet').textContent, colophon: document.querySelector('#colophon').textContent.replace(/\s+/g, ' ') }))
  fs.writeFileSync(OUT + '/combined.svg', r.svg)
  fs.writeFileSync(OUT + '/combined-cli.txt', r.cli)
  await p2.click('[data-tab=latex]')
  fs.writeFileSync(OUT + '/combined-latex.txt', await p2.$eval('#snippet', (e) => e.textContent))
  check('a shared link restores every setting', /a US Letter page/.test(r.colophon) && /60 mm/.test(r.colophon) && /right/.test(r.colophon) && /autumn/.test(r.colophon) && /teal with ochre/.test(r.colophon), r.colophon.trim())
  await p2.close()
}
check('no errors in the console', errors.length === 0, errors.join(' | '))
check('nothing from elsewhere but the pinned files', pinned.size > 0 && [...offsite].every((u) => pinned.has(u)), [...offsite].join(' ') || 'nothing')
for (const [ok, name, d] of results) console.log(`${ok.padEnd(4)}  ${name}${d ? '  -- ' + String(d).replace(/\s*\n\s*/g, ' ') : ''}`)
console.log(`${results.filter((r) => r[0] === 'pass').length}/${results.length} pass`)
await browser.close()
process.exit(results.every((r) => r[0] === 'pass') ? 0 : 1)
