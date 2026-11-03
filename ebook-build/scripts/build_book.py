#!/usr/bin/env python3
"""
Сборка книги по book.json: ePub (основной), FB2, MOBI (через Calibre)
и ознакомительные фрагменты.

    python3 build_book.py --config book.json [--date 2026-10-04] [--only main|fragments]

--date фиксирует дату на титуле и в колофоне — нужно, чтобы пересборка
из комплекта давала тот же текст, что и исходная сборка.
После сборки автоматически запускается verify_book.py; если проверка
не прошла, скрипт завершается с ошибкой.
"""

from __future__ import annotations

import argparse
import base64
import html
import re
import shutil
import subprocess
import sys
import uuid
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ebook_common import (out_path, load_config, plan, flat_chapters, chapters_clean,  # noqa: E402
                          md_to_xhtml, md_to_fb2, Config, note_xhtml, note_fb2,
                          stub_xhtml, stub_fb2, stub_md, foreword_text, garden_svg, part_garden,
                          garden_live_data, GARDEN_LIVE_JS, chapter_garden, garden_seed_data, add_initial,
                          chapters_before_garden_parts)

CSS = """@namespace epub "http://www.idpf.org/2007/ops";
body { font-family: Georgia, "Times New Roman", serif; font-size: 1em; line-height: 1.55; margin: 1em; color: #1a1a1a; }
h1, h2 { font-family: Georgia, serif; font-weight: normal; color: #1c1c1c; }
h1 { font-size: 1.6em; text-align: center; margin: 1.2em 0 1.1em 0; letter-spacing: 0.02em; }
h2 { font-size: 1.2em; text-align: center; margin: 1.4em 0 0.8em 0; }
p { margin: 0 0 0.7em 0; text-align: justify; text-indent: 0; }
blockquote { margin: 1em 2em; font-style: italic; }
em { font-style: italic; } strong { font-weight: bold; }
hr.sep { border: none; border-top: 1px solid #bbb; margin: 1.4em auto; width: 40%; }
p.theend { text-align: center; margin-top: 3em; letter-spacing: 0.25em; font-size: 0.9em; color: #555; }
.titulnaya { text-align: center; margin-top: 4em; }
.titulnaya h1 { font-size: 2.4em; letter-spacing: 0.04em; margin-bottom: 0.4em; }
.titulnaya .subtitle { font-size: 1.2em; color: #555; margin-bottom: 2em; }
.titulnaya .cycle { font-size: 0.95em; color: #888; font-style: italic; margin-bottom: 3em; }
.titulnaya .author { margin-top: 4em; font-size: 1.05em; }
.titulnaya .edition { margin-top: 4.5em; letter-spacing: 0.12em; text-transform: uppercase; font-size: 0.8em; color: #999; }
.titulnaya .build-date { font-size: 0.85em; color: #888; margin-top: 0.5em; }
.blurb { margin-top: 12%; text-align: center; }
.blurb h1 { font-size: 1.15em; text-transform: uppercase; letter-spacing: 0.12em; color: #333; margin: 0; }
.blurb .rule, .shmuc .rule, .tobecont .rule { width: 5em; border: 0; border-top: 1px solid #bbb; margin: 1.4em auto 2em auto; }
.blurb p { text-align: left; font-size: 0.98em; line-height: 1.7; color: #444; margin: 0 auto 1.1em auto; max-width: 30em; }
.shmuc { text-align: center; margin-top: 35%; }
.shmuc h1 { font-size: 1.8em; letter-spacing: 0.35em; text-indent: 0.35em; color: #444; margin: 0; }
.shmuc .shmuc-name { font-size: 1.25em; color: #666; margin-top: 1.2em; }
.tobecont { text-align: center; margin-top: 30%; }
.tobecont h1 { font-size: 1.5em; letter-spacing: 0.28em; color: #444; margin: 0; }
.tobecont p { text-align: center; color: #666; max-width: 24em; margin: 0 auto 1em auto; line-height: 1.75; }
.colophon p { font-size: 0.9em; color: #888; margin-top: 4em; text-align: center; font-style: italic; }
h3 { font-size: 1.05em; text-align: center; font-style: italic; font-weight: normal; margin: 0.6em 0 1em 0; color: #555; }
.svc-foreword h1 { font-size: 1.3em; }
.svc-note { margin: 0 0 2em 0; padding: 0.6em 0.9em; background: #f4f2ec; border-left: 3px solid #999; font-size: 0.82em; font-family: sans-serif; }
.svc-note table { border-collapse: collapse; width: 100%; }
.svc-note td { padding: 0.1em 0.6em 0.1em 0; vertical-align: top; text-align: left; }
.svc-note td.k { color: #666; font-weight: bold; width: 6.5em; }
.svc-stub { margin: 1em 0; padding: 1em; background: #f4f2ec; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; }
.svc-stub p { text-align: left; }
.svc-stub p.banner { text-align: center; letter-spacing: 0.15em; font-size: 0.85em; color: #888; font-family: sans-serif; }
.svc-stub p.row { font-size: 0.85em; color: #555; margin: 0 0 0.2em 0; font-family: sans-serif; }
.svc-stub p.src { font-size: 0.8em; color: #888; font-style: italic; margin-top: 1em; }
.svc-stub .meter { height: 6px; background: #ddd; margin: 0.6em 0 1em 0; }
.svc-stub .fill { height: 6px; background: #777; }
"""

# Только для режима с садом: спокойная книга собирается с прежним CSS байт в байт.
GARDEN_CSS = """body.garden { margin: 0; padding: 0; }
section.garden-part, div.garden { margin: 0; padding: 0; height: 100%; }
div.garden svg { display: block; width: 100%; height: 100%; }
"""

# Сады в главах: заставка над названием, буквица на плитке, концовка.
CHAPTER_GARDEN_CSS = """div.ch-head { margin: 0 0 0.4em 0; }
div.ch-head svg { display: block; width: 100%; height: auto; }
p.first { text-indent: 0; }
span.initial { float: left; font-size: 2.7em; width: 1.6em; height: 1.6em; line-height: 1.62em; text-align: center;
  margin: 0.08em 0.18em 0 0; background-repeat: no-repeat; background-position: center; background-size: 100% 100%; }
span.initial-q { font-size: 0.5em; vertical-align: top; }
div.ch-tail { clear: both; margin: 1.6em auto 0 auto; width: 55%; max-width: 16em; }
div.ch-tail svg { display: block; width: 100%; height: auto; }
div.ch-tail.ch-tail-garden { width: 100%; max-width: none; margin-top: 0.8em; }
"""


def fmt(s: str, cfg: Config, d: str) -> str:
    series = (cfg.get("series") or {}).get("name", "")
    return s.format(title=cfg["title"], subtitle=cfg.get("subtitle", ""), author=cfg["author"],
                    edition=cfg.get("edition", ""), date=d, series=series)


def esc(s: str) -> str:
    return html.escape(s, quote=False)


# ───────────────────────── ePub ─────────────────────────

def build_epub(cfg: Config, out: Path, d: str, fragment: dict | None = None) -> Path:
    from ebooklib import epub

    items = plan(cfg, fragment["until"] if fragment else None)
    lang = cfg["language"]
    book = epub.EpubBook()
    book.set_identifier(str(uuid.uuid5(uuid.NAMESPACE_URL, out.stem)))  # стабильный id: читалка узнаёт обновление
    title = cfg["title"] + (cfg.text("fragment_title_suffix") if fragment else "")
    book.set_title(title)
    book.set_language(lang)
    book.add_author(cfg["author"])
    if cfg["annotation"]:
        book.add_metadata("DC", "description", " ".join(cfg["annotation"]))
    # Служебное — в dc:source: в dc:description читатель библиотеки видит
    # описание книги, а не «бета, дата сборки».
    src_note = " · ".join(x for x in (cfg.get("edition"),
                                      f"{cfg.text('built')} {d}") if x)
    if src_note:
        book.add_metadata("DC", "source", src_note)
    if cfg.get("series"):
        s = cfg["series"]
        book.add_metadata(None, "meta", "", {"name": "calibre:series", "content": s["name"]})
        book.add_metadata(None, "meta", "", {"name": "calibre:series_index", "content": str(s.get("index", 1))})
    cover = cfg.path(cfg.get("cover"))
    if cover and cover.exists():
        book.set_cover("cover" + cover.suffix.lower(), cover.read_bytes())

    style = epub.EpubItem(uid="style_main", file_name="style/main.css", media_type="text/css",
                          content=CSS + (GARDEN_CSS if cfg.get("gardens") else "")
                          + (CHAPTER_GARDEN_CSS if cfg.get("gardens") and cfg.get("chapter_gardens") else ""))
    book.add_item(style)
    spine, counter = ["cover"] if cover and cover.exists() else [], [0]

    def page(title_, body):
        counter[0] += 1
        it = epub.EpubHtml(title=title_, file_name=f"p{counter[0]:03d}.xhtml", lang=lang)
        it.content = body
        it.add_item(style)
        book.add_item(it)
        spine.append(it)
        return it

    class RawXhtml(epub.EpubHtml):
        """Страница, которую ebooklib не перепарсивает. Его HTML-парсер
        переводит атрибуты SVG в нижний регистр (viewBox -> viewbox),
        а в XHTML это уже другой атрибут — читалка его молча игнорирует."""
        def get_content(self, default=None):
            return self.content.encode("utf-8")

        def get_body_content(self):
            return b"<div></div>"   # ebooklib ищет здесь page-list; у шмуцтитула его нет

    gardens = [0]
    live_js = []

    def garden_page(title_, part, lab, name):
        src = cfg.path(part["garden"]["image"])
        gardens[0] += 1
        ext = src.suffix.lower().replace(".jpeg", ".jpg")
        img_name = f"images/garden{gardens[0]}{ext}"
        book.add_item(epub.EpubImage(uid=f"garden{gardens[0]}", file_name=img_name,
                                     media_type="image/png" if ext == ".png" else "image/jpeg",
                                     content=src.read_bytes()))
        live = garden_live_data(cfg, part)
        script = ""
        if live:
            if not live_js:   # движок один на книгу
                live_js.append(epub.EpubItem(uid="florilegium_garden", file_name="js/florilegium-garden.js",
                                             media_type="application/javascript",
                                             content=GARDEN_LIVE_JS.read_bytes()))
                book.add_item(live_js[0])
            script = '\n<script type="text/javascript" src="js/florilegium-garden.js"></script>'
        counter[0] += 1
        it = RawXhtml(title=title_, file_name=f"p{counter[0]:03d}.xhtml", lang=lang)
        it.content = f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{lang}" xml:lang="{lang}">
<head><title>{esc(title_)}</title><link rel="stylesheet" type="text/css" href="style/main.css"/></head>
<body class="garden"><section epub:type="part" class="garden-part"><div class="garden">
{garden_svg(cfg, img_name, lab, name, live)}
</div></section>{script}</body>
</html>'''
        it.properties.append("svg")
        if live:
            it.properties.append("scripted")
        book.add_item(it)
        spine.append(it)
        return it

    series_line = ""
    if cfg.get("series"):
        series_line = f'<div class="cycle">{esc(fmt(cfg.text("series_line"), cfg, d))}</div>'
    label = cfg.text("fragment_label") if fragment else cfg.get("edition", "")
    extra = ""
    if fragment and fragment.get("range_label"):
        extra = f'<div class="build-date">{esc(fragment["range_label"])}</div>'
    titul = page(cfg.text("title_page"), f"""<div class="titulnaya">
<h1>{esc(cfg['title'])}</h1>
{f'<div class="subtitle">{esc(cfg["subtitle"])}</div>' if cfg.get('subtitle') else ''}
{series_line}
<div class="author">{esc(cfg['author'])}</div>
{f'<div class="edition">{esc(label)}</div>' if label else ''}
{extra}
<div class="build-date">{esc(cfg.text('built'))} {d}</div>
</div>""")
    toc = [epub.Link(titul.file_name, cfg.text("title_page"), "titul")]

    if cfg["annotation"]:
        paras = "".join(f"<p>{esc(p)}</p>" for p in cfg["annotation"])
        ann = page(cfg.text("annotation"),
                   f'<div class="blurb"><h1>{esc(cfg.text("annotation"))}</h1><hr class="rule"/>{paras}</div>')
        toc.append(epub.Link(ann.file_name, cfg.text("annotation"), "blurb"))

    if cfg.get("foreword"):
        ftitle, fbody = foreword_text(cfg, chapters_clean(cfg), d)
        # Страница служебная: в ней законны слова «версия», «POV». Обёрнута
        # как вставка, verify проверяет её отдельно — наличие и разметку.
        fw = page(ftitle, f'<div class="svc-foreword"><h1>{esc(ftitle)}</h1>\n{md_to_xhtml(fbody)}</div><!--/svc-->')
        toc.append(epub.Link(fw.file_name, ftitle, "foreword"))

    final = cfg.get("final_line")

    images_added = set()
    quiet_tail = chapters_before_garden_parts(cfg, items)   # перед шмуцтитулом с садом — только виньетка

    def add_png(src_rel, name):
        if name not in images_added:
            book.add_item(epub.EpubImage(uid=name.replace("/", "_").replace(".", "_"), file_name=name,
                                         media_type="image/png", content=cfg.path(src_rel).read_bytes()))
            images_added.add(name)
        return name

    def ornament_svg(href, src_rel, attr, live):
        from PIL import Image
        w, h = Image.open(cfg.path(src_rel)).size
        data = f' {attr}="{esc(live)}"' if live else ""
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"'
                f' width="100%" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"{data}>'
                f'<image width="{w}" height="{h}" xlink:href="{href}"/></svg>')

    def garden_chapter_page(ch, cg):
        """Глава с садом: заставка, буквица, концовка. Страница пишется как есть
        (RawXhtml): парсер ebooklib испортил бы регистр viewBox у SVG."""
        live = garden_seed_data(cfg, cg["seed"]) if cfg.get("gardens_live") else None
        k = cg["k"]
        head = tail = ""
        body = md_to_xhtml(ch["body"], final)
        if cg["initial"]:
            ini = add_png(cg["initial"], f"images/ch{k:02d}_initial.png")
            body, _ = add_initial(body, f"background-image:url({ini})")
        if cg["head"]:
            hh = add_png(cg["head"], f"images/ch{k:02d}_head.png")
            head = f'<div class="ch-head">{ornament_svg(hh, cg["head"], "data-florilegium-band", live)}</div>\n'
        if cg["tail"]:
            th = add_png(cg["tail"], f"images/ch{k:02d}_tail.png")
            tlive = None if ch["id"] in quiet_tail else live
            tail = f'\n<div class="ch-tail">{ornament_svg(th, cg["tail"], "data-florilegium-tail", tlive)}</div>'
        script = ""
        if live and (head or tail):
            if not live_js:
                live_js.append(epub.EpubItem(uid="florilegium_garden", file_name="js/florilegium-garden.js",
                                             media_type="application/javascript", content=GARDEN_LIVE_JS.read_bytes()))
                book.add_item(live_js[0])
            script = '\n<script type="text/javascript" src="js/florilegium-garden.js"></script>'
        counter[0] += 1
        it = RawXhtml(title=ch["title"], file_name=f"p{counter[0]:03d}.xhtml", lang=lang)
        it.content = f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{lang}" xml:lang="{lang}">
<head><title>{esc(ch["title"])}</title><link rel="stylesheet" type="text/css" href="style/main.css"/></head>
<body class="ch">{head}<h1>{esc(ch["title"])}</h1>
{note_xhtml(cfg, ch.get("note"))}
{body}{tail}{script}
</body>
</html>'''
        if head or tail:
            it.properties.append("svg")
        if script:
            it.properties.append("scripted")
        book.add_item(it)
        spine.append(it)
        return it

    def chapter_page(ch):
        cg = chapter_garden(cfg, ch)
        if cg:
            return garden_chapter_page(ch, cg)
        if ch.get("stub"):
            return page(ch["title"], f"<h1>{esc(ch['title'])}</h1>\n{stub_xhtml(cfg, ch['stub'])}")
        return page(ch["title"], f"<h1>{esc(ch['title'])}</h1>\n{note_xhtml(cfg, ch.get('note'))}"
                                 f"\n{md_to_xhtml(ch['body'], final)}")

    for it in items:
        if it[0] == "chapter":
            p = chapter_page(it[1])
            toc.append(epub.Link(p.file_name, it[1]["title"], f"c{counter[0]}"))
        else:
            part, members = it[1], it[2]
            lab, name = part.get("label", ""), part.get("name", "")
            ptitle = f"{lab}. {name}".strip(". ") if lab and name else (lab or name)
            if part_garden(cfg, part):
                pp = garden_page(ptitle, part, lab, name)
            else:
                head = f'<div class="shmuc"><h1>{esc(lab or name)}</h1><hr class="rule"/>'
                head += f'<div class="shmuc-name">{esc(name)}</div></div>' if (lab and name) else "</div>"
                pp = page(ptitle, head)
            sec_title = f"{lab.capitalize()}. {name}" if lab and name else (lab or name).capitalize()
            toc.append((epub.Section(sec_title, href=pp.file_name), tuple(chapter_page(c) for c in members)))

    if fragment:
        cont = fragment.get("continuation") or [cfg.text("fragment_end")]
        body = "".join(f"<p>{esc(p)}</p>" for p in cont)
        tc = page(cfg.text("continued").capitalize(),
                  f'<div class="tobecont"><h1>{esc(cfg.text("continued"))}</h1><hr class="rule"/>{body}</div>')
        toc.append(epub.Link(tc.file_name, cfg.text("continued").capitalize(), "tobecont"))

    colo = cfg.get("colophon")
    if colo:
        lines = "<br/>".join(esc(fmt(x, cfg, d)) for x in colo)
        cp = page(cfg.text("colophon"), f'<div class="colophon"><p>{lines}</p></div>')
        toc.append(epub.Link(cp.file_name, cfg.text("colophon"), "colophon"))

    book.toc = toc
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = spine + ["nav"]   # оглавление в конце: иначе читалка открывает книгу на нём
    out.parent.mkdir(parents=True, exist_ok=True)
    epub.write_epub(str(out), book)
    return out


# ───────────────────────── Markdown ─────────────────────────

def _slug(s: str) -> str:
    table = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh",
             "з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o",
             "п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"c",
             "ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e",
             "ю":"yu","я":"ya"}
    s = "".join(table.get(c, c) for c in s.lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def build_md(cfg: Config, out: Path, d: str, fragment: dict | None = None) -> Path:
    """Книга одним .md — для работы с иллюстрациями и для промптинга.

    Текст тот же, что в ePub: та же очистка, те же заголовки, тот же
    порядок. Отличия только служебные и невидимые при рендере:
    якорь-комментарий перед каждой главой и, если включено,
    якорь под иллюстрацию.
    """
    items = plan(cfg, fragment["until"] if fragment else None)
    opts = cfg.get("md") or {}
    final = cfg.get("final_line")

    head = [f"# {cfg['title']}", ""]
    if cfg.get("subtitle"):
        head += [f"**{cfg['subtitle']}**", ""]
    ed = cfg.get("edition")
    head += [f"*{ed} · {cfg.text('built')} {d}*" if ed
             else f"*{cfg.text('built')} {d}*", ""]
    if cfg["annotation"]:
        head += ["---", "", f"## {cfg.text('annotation')}", ""]
        head += [p for p in cfg["annotation"]] + [""]
    if cfg.get("foreword"):
        ftitle, fbody = foreword_text(cfg, chapters_clean(cfg), d)
        head += ["---", "", f"## {ftitle}", "", fbody, ""]
    head += ["---", "", "<!-- TOC -->"]

    body, toc, split_blocks = [], [f"## {cfg.text('contents')}", ""], []

    def chapter_block(ch, part=None):
        anchor = _slug(ch["title"])
        where = (part.get("name") or part.get("label")) if part else ""
        meta = f"<!-- ch: {ch['id']} | {ch['title']}"
        if where:
            meta += f" | {where}"
        meta += f" | {len(re.findall(r'[^\W\d_]+', ch['body'], re.U))} слов -->"
        blk = [f'<a id="{anchor}"></a>', meta, "", f"## {ch['title']}", ""]
        if opts.get("illustrations") and not ch.get("stub"):
            blk += [f"<!-- ill: {ch['id']} | {ch['title']} | [промпт] -->", ""]
        if ch.get("stub"):
            blk += [stub_md(cfg, ch["stub"]), ""]
        text = ch["body"]
        if final:
            text = text.replace(f"**{final}**", final)
        # подзаголовки внутри главы уводим на уровень ниже
        text = re.sub(r"(?m)^(#{2,5})(\s)", r"#\1\2", text)
        blk += [text, "", "---", ""]
        toc.append(f"- [{ch['title']}](#{anchor})")
        split_blocks.append((ch["id"], "\n".join(blk)))
        return blk

    for it in items:
        if it[0] == "chapter":
            body += chapter_block(it[1])
        else:
            part, members = it[1], it[2]
            lab, name = part.get("label", ""), part.get("name", "")
            body += ["", "---", "", f"# {lab or name}", ""]
            if lab and name:
                body += [f"### {name}", ""]
            body += ["---", ""]
            toc += ["", f"### {(lab + '. ' + name).strip('. ') if lab and name else (lab or name)}", ""]
            for c in members:
                body += chapter_block(c, part)

    if fragment:
        cont = fragment.get("continuation") or [cfg.text("fragment_end")]
        body += [f"## {cfg.text('continued').capitalize()}", ""] + cont + ["", "---", ""]

    doc = "\n".join(head[:head.index("<!-- TOC -->")] + toc + [""] + body)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")

    if opts.get("split"):
        d2 = out.parent / f"{out.stem}_chapters"
        d2.mkdir(exist_ok=True)
        for i, (cid, blk) in enumerate(split_blocks, start=1):
            stem = re.sub(r"\.md$", "", str(cid))
            (d2 / f"{i:02d}_{stem}.md").write_text(blk, encoding="utf-8")
        print(f"Собрано: {d2}  ({len(split_blocks)} глав)")
    return out


# ───────────────────────── FB2 ─────────────────────────

def build_fb2(cfg: Config, out: Path, d: str, fragment: dict | None = None) -> Path:
    items = plan(cfg, fragment["until"] if fragment else None)
    final = cfg.get("final_line")

    def section(title, body):
        return f"<section>\n<title><p>{esc(title)}</p></title>\n{body}\n</section>"

    counter = [0]

    def ch_body(c):
        counter[0] += 1
        if c.get("stub"):
            return stub_fb2(cfg, c["stub"], str(counter[0]))
        return note_fb2(cfg, c.get("note"), str(counter[0])) + md_to_fb2(c["body"], final)

    parts, garden_bins = [], []

    def b64_lines(data: bytes) -> str:
        b = base64.b64encode(data).decode("ascii")
        return "\n".join(b[i:i + 76] for i in range(0, len(b), 76))

    def garden_image(part) -> str:
        # FB2 не умеет текст поверх картинки: сад идёт под заголовком части
        src = cfg.path(part["garden"]["image"])
        ext = src.suffix.lower().replace(".jpeg", ".jpg")
        gid = f"garden{len(garden_bins) + 1}{ext}"
        ctype = "image/png" if ext == ".png" else "image/jpeg"
        garden_bins.append(f'<binary id="{gid}" content-type="{ctype}">\n{b64_lines(src.read_bytes())}\n</binary>')
        return f'<image l:href="#{gid}"/>'

    if cfg.get("foreword"):
        ftitle, fbody = foreword_text(cfg, chapters_clean(cfg), d)
        parts.append(section(ftitle, f'<cite id="svc-foreword">{md_to_fb2(fbody)}</cite>'))
    for it in items:
        if it[0] == "chapter":
            parts.append(section(it[1]["title"], ch_body(it[1])))
        else:
            part, members = it[1], it[2]
            tp = "".join(f"<p>{esc(x)}</p>" for x in (part.get("label"), part.get("name")) if x)
            img = garden_image(part) + "\n" if part_garden(cfg, part) else ""
            inner = "\n".join(section(c["title"], ch_body(c)) for c in members)
            parts.append(f"<section>\n<title>{tp}</title>\n{img}{inner}\n</section>")
    if fragment:
        cont = fragment.get("continuation") or [cfg.text("fragment_end")]
        parts.append(section(cfg.text("continued"), "".join(f"<p>{esc(p)}</p>" for p in cont)))

    ann = "\n".join(f"<p>{esc(p)}</p>" for p in cfg["annotation"])
    cover = cfg.path(cfg.get("cover"))
    cover_tag = binary = ""
    if cover and cover.exists():
        ctype = "image/png" if cover.suffix.lower() == ".png" else "image/jpeg"
        cid = "cover" + cover.suffix.lower()
        b64 = base64.b64encode(cover.read_bytes()).decode("ascii")
        b64 = "\n".join(b64[i:i + 76] for i in range(0, len(b64), 76))
        cover_tag = f'<coverpage><image l:href="#{cid}"/></coverpage>'
        binary = f'<binary id="{cid}" content-type="{ctype}">\n{b64}\n</binary>'
    seq = ""
    if cfg.get("series"):
        s = cfg["series"]
        seq = f'<sequence name="{html.escape(s["name"])}" number="{s.get("index", 1)}"/>'
    a_parts = cfg["author"].split()
    author = (f"<first-name>{esc(a_parts[0])}</first-name>"
              + (f"<last-name>{esc(' '.join(a_parts[1:]))}</last-name>" if len(a_parts) > 1 else ""))
    genres = "".join(f"<genre>{g}</genre>" for g in cfg["genres_fb2"])
    title = cfg["title"] + (cfg.text("fragment_title_suffix") if fragment else "")
    label = cfg.text("fragment_label") if fragment else cfg.get("edition", "")
    body_title = "".join(f"<p>{esc(x)}</p>" for x in (cfg["title"], cfg.get("subtitle")) if x)
    epigraph = f"<epigraph><p><emphasis>{esc(label)}</emphasis></p></epigraph>" if label else ""
    doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, out.stem))

    fb2 = f"""<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description>
<title-info>
{genres}
<author>{author}</author>
<book-title>{esc(title)}</book-title>
<annotation>
{ann}
</annotation>
{cover_tag}
<lang>{cfg['language']}</lang>
{seq}
</title-info>
<document-info>
<author>{author}</author>
<program-used>ebook-build/build_book.py</program-used>
<date value="{d}">{d}</date>
<id>{doc_id}</id>
<version>1.0</version>
</document-info>
</description>
<body>
<title>{body_title}</title>
{epigraph}
{chr(10).join(parts)}
</body>
{binary}{"".join(chr(10) + b for b in garden_bins)}
</FictionBook>"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(fb2, encoding="utf-8")
    import xml.etree.ElementTree as ET
    ET.parse(out)   # сломанный XML — сразу ошибка, а не тихая порча
    return out


# ───────────────────────── MOBI ─────────────────────────

def build_mobi(cfg: Config, epub_path: Path, out: Path) -> Path | None:
    exe = shutil.which("ebook-convert")
    if not exe:
        print("  ! MOBI пропущен: нет ebook-convert (Calibre). См. scripts/setup_env.sh", file=sys.stderr)
        return None
    cmd = [exe, str(epub_path), str(out), "--mobi-file-type=both", "--output-profile=kindle",
           f"--title={cfg['title']}", f"--authors={cfg['author']}", f"--language={cfg['language']}"]
    if cfg.get("series"):
        cmd += [f"--series={cfg['series']['name']}", f"--series-index={cfg['series'].get('index', 1)}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not out.exists():
        raise SystemExit(f"MOBI не собран:\n{r.stderr[-1500:]}")
    return out


# ───────────────────────── точка входа ─────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--date", default=date.today().isoformat())
    ap.add_argument("--only", choices=["main", "fragments"])
    ap.add_argument("--mode", help="режим сборки из modes в book.json")
    ap.add_argument("--all-modes", action="store_true",
                    help="собрать все режимы подряд")
    ap.add_argument("--no-verify", action="store_true")
    ap.add_argument("--gardens", action="store_true",
                    help="режим с садом: сады на шмуцтитулах частей (к имени файла — суффикс)")
    ap.add_argument("--live", action="store_true",
                    help="с --gardens: живой сад — перерастает под экран читалки (скрипт в ePub)")
    a = ap.parse_args()
    if a.live and not a.gardens:
        a.gardens = True
    g_flag = (["--gardens"] if a.gardens else []) + (["--live"] if a.live else [])

    if a.all_modes:
        import json as _json
        modes = list(_json.loads(Path(a.config).read_text(encoding="utf-8"))
                     .get("modes") or {})
        if not modes:
            raise SystemExit("book.json: режимы не заданы, --all-modes нечего собирать")
        rc = 0
        for m in modes:
            print(f"\n=== режим: {m} ===")
            r = subprocess.run([sys.executable, __file__, "--config", a.config,
                                "--date", a.date, "--mode", m, "--no-verify"] + g_flag)
            rc = rc or r.returncode
        if not a.no_verify:
            verify = Path(__file__).resolve().parent / "verify_book.py"
            r = subprocess.run([sys.executable, str(verify), "--config", a.config,
                                "--all-modes"] + g_flag)
            rc = rc or r.returncode
        sys.exit(rc)

    cfg = load_config(a.config, a.mode, a.gardens, a.live)
    outdir = cfg.path(cfg["output_dir"])
    if cfg["gardens"]:
        n_g = sum(1 for p in cfg["parts"] if part_garden(cfg, p))
        print(f"  режим с садом: садов {n_g}, файлы с суффиксом «{cfg['gardens_suffix']}»"
              + ("; живой сад: перерастает под экран" if cfg["gardens_live"] else ""))
    built = []

    # Публичное название в конфиге против рабочего H1 в файле: книга
    # соберётся правильно, но автор, открыв исходник, увидит старое имя.
    cl = chapters_clean(cfg)
    for c in cl:
        if c.get("renamed"):
            print(f"  WARN: заголовок из titles «{c['title']}» "
                  f"вместо «{c['source_title']}» в {c['id']}")
        if c["info"].get("dropped_h1"):
            print(f"  WARN: в {c['id']} несколько H1 подряд, отброшены: "
                  + "; ".join(f"«{x}»" for x in c["info"]["dropped_h1"]))
        if (c.get("note") or {}).get("_version_mismatch"):
            print(f"  WARN: версия {c['id']}: {c['note']['_version_mismatch']} — на плашке версия из файла")
    stubs = [c["title"] for c in cl if c.get("stub")]
    if stubs:
        print(f"  WARN: плашек вместо глав: {len(stubs)} — " + "; ".join(stubs))

    if a.only != "fragments":
        base = outdir / cfg["basename"]
        ep = None
        if "epub" in cfg["formats"] or "mobi" in cfg["formats"]:
            ep = build_epub(cfg, out_path(base, "epub"), a.date)
            built.append(ep)
        if "fb2" in cfg["formats"]:
            built.append(build_fb2(cfg, out_path(base, "fb2"), a.date))
        if "md" in cfg["formats"]:
            built.append(build_md(cfg, out_path(base, "md"), a.date))
        if "mobi" in cfg["formats"] and ep:
            m = build_mobi(cfg, ep, out_path(base, "mobi"))
            if m:
                built.append(m)

    if a.only != "main":
        for fr in cfg["fragments"]:
            base = outdir / fr["basename"]
            if "epub" in fr["formats"] or "mobi" in fr["formats"]:
                ep = build_epub(cfg, out_path(base, "epub"), a.date, fr)
                built.append(ep)
            if "fb2" in fr["formats"]:
                built.append(build_fb2(cfg, out_path(base, "fb2"), a.date, fr))
            if "md" in fr["formats"]:
                built.append(build_md(cfg, out_path(base, "md"), a.date, fr))
            if "mobi" in fr["formats"]:
                m = build_mobi(cfg, ep, out_path(base, "mobi"))
                if m:
                    built.append(m)

    for p in built:
        print(f"Собрано: {p}  {p.stat().st_size / 1024:.0f} КБ")
    if not a.no_verify:
        verify = Path(__file__).resolve().parent / "verify_book.py"
        cmd = [sys.executable, str(verify), "--config", a.config]
        if a.mode:
            cmd += ["--mode", a.mode]
        r = subprocess.run(cmd + g_flag)
        sys.exit(r.returncode)


if __name__ == "__main__":
    main()
