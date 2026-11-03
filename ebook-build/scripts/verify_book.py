#!/usr/bin/env python3
"""
Проверка готовых книг против исходников из book.json.

    python3 verify_book.py --config book.json

Проверяет каждую цель (основная книга и каждый фрагмент) в каждом формате:
  • файл есть и открывается (ePub — zip с mimetype первым, все страницы — XML;
    FB2 — валидный XML; MOBI — обратная конвертация в текст через Calibre);
  • метаданные: название, автор, язык, обложка, аннотация;
  • каждая глава на месте — по 5 фраз из начала, середины и конца;
  • во фрагменте нет ни одной фразы из глав после границы;
  • оглавление: все главы и части, в правильном порядке;
  • отбивки сцен: столько же, сколько «---» в исходниках;
  • утечки: служебные пометки и необработанная разметка (**, #, ![](), <!-- -->);
  • финальная строка книги — ровно одна (если задана);
  • страница «Продолжение следует» во фрагменте;
  • число слов сходится с исходниками.
Код выхода 1, если есть хотя бы один FAIL.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ebook_common import (out_path, strip_tags, load_config, plan, flat_chapters, chapters_clean, probes,  # noqa: E402
                          norm, md_plain, scene_breaks, epub_files, DEFAULT_LEAKS,
                          SVC_EPUB_RE, SVC_FB2_RE, SVC_MD_RE, foreword_text, part_garden,
                          garden_live_data, chapter_garden, chapters_before_garden_parts)

FB2NS = "{http://www.gribuser.ru/xml/fictionbook/2.0}"


class Report:
    def __init__(self):
        self.rows, self.fails = [], 0

    def add(self, status, target, fmt, what, detail=""):
        self.rows.append((status, target, fmt, what, detail))
        if status == "FAIL":
            self.fails += 1

    def print(self):
        for st, t, f, w, d in self.rows:
            mark = {"OK": "  ok ", "WARN": " warn", "FAIL": " FAIL"}[st]
            d = re.sub(r"\s+", " ", d)
            print(f"{mark}  {t:<34} {f:<5} {w}" + (f" — {d}" if d else ""))


def raw_text_keep_marks(s: str) -> str:
    """Текст без тегов, но со звёздочками и решётками — для поиска утечек разметки."""
    return html.unescape(strip_tags(s)).replace("\u00a0", " ")


def mobi_to_text(p: Path) -> str | None:
    exe = shutil.which("ebook-convert")
    if not exe:
        return None
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "x.txt"
        subprocess.run([exe, str(p), str(out)], capture_output=True)
        return out.read_text(encoding="utf-8", errors="replace") if out.exists() else None


def check_target(cfg, rep: Report, name: str, base: Path, formats, until=None, fragment=None):
    items = plan(cfg, until)
    included = flat_chapters(items)
    inc_ids = {c["id"] for c in included}
    excluded = [c for c in chapters_clean(cfg) if c["id"] not in inc_ids]
    final = cfg.get("final_line")
    expect_final = 1 if final and any(f"**{final}**" in c["body"] for c in included) else 0
    src_breaks = sum(scene_breaks(c["body"]) for c in included)
    src_words = sum(len(md_plain(c["body"]).split()) for c in included)
    leak_pats = [p for p in DEFAULT_LEAKS if p not in cfg["leak_ignore"]] + cfg["leak_patterns"]
    stubs = [c for c in included if c.get("stub")]
    if stubs:
        rep.add("WARN", name, "", f"плашек вместо глав: {len(stubs)}",
                "; ".join(c["title"] for c in stubs[:6]))
    all_src = {c["id"]: norm(md_plain(c["body"])) for c in chapters_clean(cfg)}
    part_titles = [(p[1].get("label") or "", p[1].get("name") or "") for p in items if p[0] == "part"]
    gparts = [p[1] for p in items if p[0] == "part" and part_garden(cfg, p[1])]
    # спокойная сборка книги, у которой сады описаны: садов быть не должно
    calm_guard = not cfg.get("gardens") and (any(p[0] == "part" and p[1].get("garden") for p in items)
                                             or bool(cfg.get("chapter_gardens")))
    ch_gardens = [c for c in included if chapter_garden(cfg, c)]

    for fmt in formats:
        path = out_path(base, fmt)
        if not path.exists():
            if fmt == "mobi" and not shutil.which("ebook-convert"):
                rep.add("WARN", name, fmt, "файла нет", "Calibre не установлен, MOBI не собирался")
            else:
                rep.add("FAIL", name, fmt, "файла нет", str(path))
            continue

        nav_titles, raw, text, breaks, svc_source = None, "", "", None, ""
        leak_pats_fmt = leak_pats
        if fmt == "md":
            raw_file = path.read_text(encoding="utf-8")
            # Тела глав вырезаем по служебным якорям — они для того и стоят.
            parts_md = re.split(r'<a id="[^"]*"></a>\s*\n<!-- ch: ', raw_file)[1:]
            bodies = []
            for blk in parts_md:
                b = re.sub(r"^.*?-->\s*\n", "", blk, count=1, flags=re.S)
                b = re.sub(r"(?m)^## .*$", "", b, count=1)
                b = re.sub(r"<!-- ill:.*?-->", "", b, flags=re.S)
                b = re.sub(SVC_MD_RE, "", b, flags=re.S)
                # шмуцтитул следующей части лежит в хвосте блока — отрезаем
                b = re.split(r"\n---\s*\n\s*\n#\s", b)[0]
                b = re.sub(r"\n---\s*\Z", "", b.rstrip())
                bodies.append(b.strip())
            raw = "\n\n".join(bodies)
            # Слова по каждой главе: допуск в процент на всю книгу пропускает
            # потерю десятка абзацев. Текст md собран тем же пайплайном, что
            # исходник, поэтому сверка поглавная и точная.
            if len(bodies) == len(included):
                bad = []
                for c, b in zip(included, bodies):
                    ws, wm = len(md_plain(c["body"]).split()), len(norm(md_plain(b)).split())
                    if ws != wm:
                        bad.append(f"{c['id']}: {wm} из {ws}")
                rep.add("FAIL" if bad else "OK", name, fmt, "слова по главам совпадают точно",
                        "; ".join(bad[:4]))
            else:
                rep.add("FAIL", name, fmt, "главы в md", f"{len(bodies)} блоков против {len(included)} глав")
            text = norm(md_plain(raw))
            breaks = sum(len(re.findall(r"(?m)^---\s*$", b)) for b in bodies)
            nav_titles = ([m.group(1) for m in
                           re.finditer(r"(?m)^- \[(.+?)\]\(#", raw_file)]
                          + re.findall(r"(?m)^### (.+)$",
                                       raw_file[:raw_file.find("<a id=")]))
            # В Markdown разметка — это формат, а не утечка: ищем только
            # служебные пометки автора.
            leak_pats_fmt = [x for x in leak_pats if not any(
                s in x for s in (r"\*\*", r"(?=\w)", r"!\[", r"\]\(", "#{1,6}", "-{3,}"))]
        elif fmt == "epub":
            with zipfile.ZipFile(path) as z:
                names = z.namelist()
                first = z.infolist()[0]
                ok_mt = names[0] == "mimetype" and first.compress_type == zipfile.ZIP_STORED
                rep.add("OK" if ok_mt else "FAIL", name, fmt, "контейнер ePub",
                        "" if ok_mt else "mimetype не первым или сжат")
            files = epub_files(path)
            bad_xml = []
            for n, t in files.items():
                if n.endswith((".xhtml", ".opf", ".ncx")):
                    try:
                        ET.fromstring(t.encode("utf-8"))
                    except ET.ParseError as e:
                        bad_xml.append(f"{n}: {e}")
            rep.add("FAIL" if bad_xml else "OK", name, fmt, "все страницы — валидный XML", "; ".join(bad_xml[:3]))
            opf = next((t for n, t in files.items() if n.endswith(".opf")), "")
            meta_ok = all(re.search(rf"<dc:{k}[^>]*>[^<]+</dc:{k}>", opf) for k in ("title", "creator", "language"))
            rep.add("OK" if meta_ok else "FAIL", name, fmt, "метаданные: название, автор, язык")
            if cfg.get("cover"):
                has_cover = "cover-image" in opf or 'name="cover"' in opf
                rep.add("OK" if has_cover else "FAIL", name, fmt, "обложка в ePub")
            nav = next((t for n, t in files.items() if "nav" in n and n.endswith(".xhtml")), "")
            nav_titles = [norm(re.sub(r"<[^>]+>", "", m)) for m in re.findall(r"<a[^>]*>(.*?)</a>", nav, re.S)]
            svc_source = " ".join(t for n, t in sorted(files.items()) if n.endswith(".xhtml"))
            pages = {n: re.sub(SVC_EPUB_RE, " ", t, flags=re.S)
                     for n, t in files.items() if n.endswith((".xhtml", ".html")) and "nav" not in n}
            raw = raw_text_keep_marks(" ".join(t for _, t in sorted(pages.items())))
            text = norm(raw)
            breaks = sum(t.count('class="sep"') for t in pages.values())
            if gparts:
                # сады: картинка в архиве, страница ссылается на неё, атрибуты SVG
                # в исходном регистре (viewbox вместо viewBox читалка игнорирует)
                gpages = {n: t for n, t in files.items()
                          if n.endswith(".xhtml") and re.search(r'xlink:href="images/garden\d+', t)}
                problems = []
                for n, t in gpages.items():
                    href = re.search(r'xlink:href="(images/garden[^"]+)"', t).group(1)
                    full = str(Path(n).parent / href).replace("\\", "/")
                    if full not in names:
                        problems.append(f"{n}: нет файла {href}")
                    if 'viewBox="' not in t or 'preserveAspectRatio="' not in t:
                        problems.append(f"{n}: атрибуты SVG испорчены")
                    if not re.search(rf'href="{re.escape(Path(n).name)}"[^>]*properties="(?:[^"]* )?svg(?: [^"]*)?"', opf):
                        problems.append(f"{n}: нет properties=svg в манифесте")
                if len(gpages) != len(gparts):
                    problems.append(f"страниц с садом {len(gpages)} против {len(gparts)} в book.json")
                rep.add("FAIL" if problems else "OK", name, fmt, f"сады на шмуцтитулах: {len(gparts)}",
                        "; ".join(problems[:3]))
                check_live(cfg, rep, name, fmt, path, gparts, gpages, names, opf)
            if ch_gardens:
                quiet = chapters_before_garden_parts(cfg, items) & {c["id"] for c in ch_gardens}
                check_chapter_gardens(cfg, rep, name, fmt, path, ch_gardens, files, names, opf, len(quiet))
            if not cfg.get("gardens_live") and (gparts or ch_gardens or calm_guard):
                js = [n for n in names if n.endswith(".js")]
                rep.add("FAIL" if js else "OK", name, fmt, "без живого сада: скриптов нет", ", ".join(js[:3]))
            if calm_guard:
                stray = [n for n in names if re.search(r"images/(?:garden\d+|ch\d+_(?:head|tail|initial))\.", n)]
                rep.add("FAIL" if stray else "OK", name, fmt, "спокойная сборка: садов нет",
                        ", ".join(stray[:3]))
        elif fmt == "fb2":
            try:
                tree = ET.parse(path)
                rep.add("OK", name, fmt, "валидный XML")
            except ET.ParseError as e:
                rep.add("FAIL", name, fmt, "валидный XML", str(e))
                continue
            root = tree.getroot()
            ti = root.find(f"{FB2NS}description/{FB2NS}title-info")
            meta_ok = ti is not None and all(ti.find(FB2NS + k) is not None for k in ("book-title", "author", "lang"))
            rep.add("OK" if meta_ok else "FAIL", name, fmt, "метаданные: название, автор, язык")
            if cfg.get("cover"):
                ok_c = ti is not None and ti.find(f"{FB2NS}coverpage") is not None and root.find(f"{FB2NS}binary") is not None
                rep.add("OK" if ok_c else "FAIL", name, fmt, "обложка в FB2")
            if cfg["annotation"]:
                ann = ti.find(f"{FB2NS}annotation") if ti is not None else None
                ann_txt = norm("".join(ann.itertext())) if ann is not None else ""
                ok_a = norm(cfg["annotation"][0])[:50] in ann_txt
                rep.add("OK" if ok_a else "FAIL", name, fmt, "аннотация в описании")
            body = root.find(f"{FB2NS}body")
            if gparts:
                bins = {b.get("id") for b in root.findall(f"{FB2NS}binary")}
                refs = [im.get("{http://www.w3.org/1999/xlink}href", "").lstrip("#")
                        for im in body.iter(f"{FB2NS}image")]
                grefs = [r for r in refs if r.startswith("garden")]
                problems = [f"нет бинарника {r}" for r in grefs if r not in bins]
                if len(grefs) != len(gparts):
                    problems.append(f"картинок сада {len(grefs)} против {len(gparts)} в book.json")
                rep.add("FAIL" if problems else "OK", name, fmt, f"сады на шмуцтитулах: {len(gparts)}",
                        "; ".join(problems[:3]))
            if calm_guard:
                stray = [b.get("id") for b in root.findall(f"{FB2NS}binary") if (b.get("id") or "").startswith("garden")]
                rep.add("FAIL" if stray else "OK", name, fmt, "спокойная сборка: садов нет",
                        ", ".join(stray[:3]))
            nav_titles = []
            for sec in body.iter(f"{FB2NS}section"):
                t = sec.find(f"{FB2NS}title")
                if t is not None:
                    nav_titles.append(norm(" ".join(t.itertext())))
            s = path.read_text(encoding="utf-8")
            s = re.sub(r"<binary.*?</binary>", " ", s, flags=re.S)
            s = re.sub(r"<description>.*?</description>", " ", s, flags=re.S)
            svc_source = s
            s = re.sub(SVC_FB2_RE, " ", s, flags=re.S)
            breaks = s.count("<p><emphasis>* * *</emphasis></p>")
            raw = raw_text_keep_marks(s.replace("<p><emphasis>* * *</emphasis></p>", " "))
            text = norm(raw)
        elif fmt == "mobi":
            t = mobi_to_text(path)
            if t is None:
                rep.add("WARN", name, fmt, "обратная конвертация", "нет ebook-convert — MOBI не проверен")
                continue
            rep.add("OK", name, fmt, "обратная конвертация в текст")
            raw, text = t, norm(t)

        # главы на месте
        missing = []
        for c in included:
            pr = probes(c["body"])
            lost = [p for p in pr if p not in text]
            if lost:
                missing.append(f"{c['id']} ({len(lost)}/{len(pr)}: «{lost[0][:60]}…»)")
        rep.add("FAIL" if missing else "OK", name, fmt,
                f"все {len(included)} глав на месте (по 5 фраз)", "; ".join(missing[:4]))
        # лишнего нет
        if excluded:
            # только фразы, которых нет в главах до границы: рефрены и повторы не в счёт
            inc_text = " ".join(md_plain(c["body"]) for c in included)
            leaked = [c["id"] for c in excluded
                      if any(p in text for p in probes(c["body"]) if p not in inc_text)]
            rep.add("FAIL" if leaked else "OK", name, fmt,
                    f"нет текста из {len(excluded)} глав за границей", ", ".join(leaked[:5]))
        # оглавление
        if nav_titles is not None:
            pos, order_ok, absent = -1, True, []
            for c in included:
                t = norm(c["title"])
                if t in nav_titles:
                    i = nav_titles.index(t)
                    if i < pos:
                        order_ok = False
                    pos = i
                else:
                    absent.append(c["title"])
            for lab, nm in part_titles:
                if not any((nm and nm in x) or (lab and lab.lower() in x.lower()) for x in nav_titles):
                    absent.append("часть «" + (lab + " " + nm).strip() + "»")
            ok = not absent and order_ok
            rep.add("OK" if ok else "FAIL", name, fmt, "оглавление: главы и части по порядку",
                    ("нет: " + "; ".join(absent[:4])) if absent else ("" if order_ok else "порядок нарушен"))
        # отбивки
        if breaks is not None:
            rep.add("OK" if breaks == src_breaks else "FAIL", name, fmt,
                    f"отбивки сцен: {breaks} из {src_breaks}")
        # утечки
        leaks = []
        for pat in (leak_pats_fmt if fmt == "md" else leak_pats):
            found = list(re.finditer(pat, raw))
            if found:
                m = found[0]
                ctx = re.sub(r"\s+", " ", raw[max(0, m.start() - 30):m.end() + 30]).strip()
                leaks.append(f"/{pat}/ ×{len(found)}: «{ctx}»")
        rep.add("FAIL" if leaks else "OK", name, fmt, "нет служебных пометок и сырой разметки",
                (f"{len(leaks)} вид(а): " + " | ".join(leaks)) if leaks else "")
        # финальная строка
        if final:
            n = text.count(norm(final))
            rep.add("OK" if n == expect_final else "FAIL", name, fmt,
                    f"финальная строка «{final}»: {n} (нужно {expect_final})")
        # аннотация (ePub)
        if fmt == "epub" and cfg["annotation"]:
            ok_a = norm(cfg["annotation"][0])[:50] in text
            rep.add("OK" if ok_a else "FAIL", name, fmt, "страница аннотации")
        # продолжение следует
        if fragment and fmt in ("epub", "fb2"):
            ok_c = norm(cfg.text("continued")) in text or norm(cfg.text("continued")).capitalize() in text
            rep.add("OK" if ok_c else "FAIL", name, fmt, "страница «продолжение следует»")
        # «От автора»: служебная страница, из прозы вырезана — проверяем её
        # по сырому файлу: что она есть и что в ней нет сырой разметки.
        if cfg.get("foreword") and fmt in ("epub", "fb2"):
            # Дату сборки проверка не знает: вместо неё — разрыв, и ищем самый
            # длинный кусок текста между подстановками.
            _, fbody = foreword_text(cfg, chapters_clean(cfg), "\x00")
            pieces = [norm(x) for x in md_plain(fbody).split("\x00")]
            first = max(pieces, key=len)[:60]
            m = re.search(r'(?:<div class="svc-foreword">|<cite id="svc-foreword">)(.*?)(?:</div>\s*<!--/svc-->|</cite>)',
                          svc_source, re.S)
            fw_raw = raw_text_keep_marks(m.group(1)) if m else ""
            bad = [p for p in (r"\*\*", r"(?<![\w*])\*(?=\w)", r"(?:^|\s)#{1,6} \S") if re.search(p, fw_raw)]
            ok = bool(m) and first in norm(fw_raw) and not bad
            rep.add("OK" if ok else "FAIL", name, fmt, "страница «от автора»",
                    "" if ok else ("нет страницы" if not m else f"сырая разметка: {bad}"))
        # контрольные фразы автора
        for item in cfg["must_contain"]:
            phrase = item if isinstance(item, str) else item.get("text", "")
            chap = None if isinstance(item, str) else item.get("chapter")
            ph = norm(phrase)
            if chap:
                in_src = ph in all_src.get(chap, "")
                if chap not in inc_ids:
                    continue
            else:
                in_src = any(ph in all_src[c["id"]] for c in included)
                if not in_src and any(ph in v for v in all_src.values()):
                    continue      # фраза в главах за границей фрагмента
            if not in_src:
                rep.add("FAIL", name, fmt, f"контрольная фраза «{phrase[:50]}»",
                        f"нет в исходнике{' ' + chap if chap else ''}")
            else:
                rep.add("OK" if ph in text else "FAIL", name, fmt,
                        f"контрольная фраза «{phrase[:50]}»", "" if ph in text else "потеряна при сборке")
        # Слова. Заголовок главы в ePub попадает и в <title>, и в <h1>,
        # то есть считается дважды — иначе сверка с другим форматом даёт
        # ложное расхождение. Вычитаем его один раз на главу.
        if fmt in ("epub", "fb2", "md"):
            w = len(text.split())
            if fmt == "epub":
                w -= sum(len(c["title"].split()) for c in included)
            ratio = w / src_words if src_words else 0
            if fmt == "md":
                # В md нет титула, аннотации и колофона — только проза,
                # поэтому расхождение здесь означает реальную потерю текста.
                st = "OK" if 0.99 <= ratio <= 1.01 else "FAIL"
            else:
                st = "OK" if 0.97 <= ratio <= 1.10 else "WARN"
            rep.add(st, name, fmt, f"слов: {w} против {src_words} в исходниках ({ratio:.1%})")


def check_live(cfg, rep: Report, name, fmt, path: Path, gparts, gpages, names, opf):
    """Живой сад: страница несёт данные и скрипт, манифест помечает её scripted,
    картинка-запаска на месте, а движок из самой книги растит каждый сад
    (если есть node) — на листе статичной картинки и на узком, как у телефона."""
    if not cfg.get("gardens_live"):
        return
    want = [w for w in (garden_live_data(cfg, p) for p in gparts) if w]
    problems = []
    live_pages = {n: t for n, t in gpages.items() if "data-florilegium=" in t}
    js_name = next((n for n in names if n.endswith("js/florilegium-garden.js")), None)
    if not js_name:
        problems.append("нет js/florilegium-garden.js")
    for n, t in live_pages.items():
        if 'src="js/florilegium-garden.js"' not in t:
            problems.append(f"{n}: нет скрипта")
        if not re.search(rf'href="{re.escape(Path(n).name)}"[^>]*properties="[^"]*scripted', opf):
            problems.append(f"{n}: нет properties=scripted в манифесте")
        if 'xlink:href="images/garden' not in t:
            problems.append(f"{n}: нет картинки-запаски")
    if len(live_pages) != len(want):
        problems.append(f"живых шмуцтитулов {len(live_pages)} против {len(want)} частей с seed")
    rep.add("FAIL" if problems else "OK", name, fmt, f"живой сад: шмуцтитулов {len(live_pages)}",
            "; ".join(problems[:3]))
    if problems:
        return
    node = shutil.which("node")
    if not node:
        rep.add("WARN", name, fmt, "живой сад: движок не прогнан", "нет node — проверьте страницу в читалке")
        return
    with zipfile.ZipFile(path) as z:
        js = z.read(js_name).decode("utf-8")
    seeds = sorted({int(re.search(r'data-florilegium="(\d+)', t).group(1)) for t in live_pages.values()})
    probe = "var window = {};\n" + js + ("\n;(function () { var F = window.FlorilegiumGarden, out = [];\n"
             "%s.forEach(function (s) { [[120, 36, 12], [90, 27, 9]].forEach(function (w) {\n"
             "  var t = Date.now(), r = F.page({ seed: s, paper: w[0] + 'x200', left: w[1] + 'mm', right: w[2] + 'mm',\n"
             "    top: '36mm', bottom: '12mm', headsep: '0mm', headheight: '0pt', textend: '50mm' });\n"
             "  out.push([s, w[0], r.svg.length, r.stats.motifs, Date.now() - t]); }); });\n"
             "console.log(JSON.stringify(out)); })();\n") % json.dumps(seeds)
    with tempfile.TemporaryDirectory() as td:
        f = Path(td, "probe.js")
        f.write_text(probe, encoding="utf-8")
        r = subprocess.run([node, str(f)], capture_output=True, text=True, timeout=300)
    if r.returncode:
        tail = ((r.stderr or r.stdout).strip().splitlines() or ["?"])[-1]
        rep.add("FAIL", name, fmt, "живой сад: движок упал", tail[:200])
        return
    res = json.loads(r.stdout.strip().splitlines()[-1])
    thin = [f"seed {s} лист {w}" for s, w, n, m, _ in res if n < 50000 or m < 10]
    slow = max(x[4] for x in res)
    rep.add("FAIL" if thin else "OK", name, fmt, f"живой сад: движок растит садов {len(seeds)}",
            ("пустые: " + ", ".join(thin)) if thin else f"до {slow} мс на сад в node")


def check_chapter_gardens(cfg, rep: Report, name, fmt, path: Path, chs, files, names, opf, quiet=0):
    """Сады в главах: у каждой главы с садом — заставка и концовка (картинки в архиве,
    атрибуты SVG в исходном регистре, страница помечена svg), буквица там, где
    первый абзац начинается с буквы; в живом режиме — данные, скрипт, scripted
    и прогон движка заставки, сада в конце главы, виньетки и плитки."""
    cg = cfg["chapter_gardens"]
    pages = {n: t for n, t in files.items() if n.endswith(".xhtml") and '<body class="ch">' in t}
    problems = []
    if len(pages) != len(chs):
        problems.append(f"страниц глав с садом {len(pages)} против {len(chs)}")
    heads = tails = inits = 0
    live = cfg.get("gardens_live")
    for n, t in pages.items():
        for href in re.findall(r'(?:xlink:href="|url\()(images/ch\d+_(?:head|tail|initial)\.png)', t):
            if str(Path(n).parent / href).replace("\\", "/") not in names:
                problems.append(f"{n}: нет файла {href}")
        h = 'class="ch-head"' in t
        tl = 'class="ch-tail"' in t
        heads += h
        tails += tl
        inits += 'class="initial"' in t
        if (h or tl) and ('viewBox="' not in t):
            problems.append(f"{n}: атрибуты SVG испорчены")
        if (h or tl) and not re.search(rf'href="{re.escape(Path(n).name)}"[^>]*properties="(?:[^"]* )?svg(?: [^"]*)?"', opf):
            problems.append(f"{n}: нет properties=svg в манифесте")
        if live and (h or tl):
            if "data-florilegium-band=" not in t and "data-florilegium-tail=" not in t:
                problems.append(f"{n}: нет данных живого сада")
            if 'src="js/florilegium-garden.js"' not in t:
                problems.append(f"{n}: нет скрипта")
            if not re.search(rf'href="{re.escape(Path(n).name)}"[^>]*properties="[^"]*scripted', opf):
                problems.append(f"{n}: нет properties=scripted в манифесте")
    if cg["head"] and heads != len(chs):
        problems.append(f"заставок {heads} из {len(chs)}")
    if cg["tail"] and tails != len(chs):
        problems.append(f"концовок {tails} из {len(chs)}")
    if live and cg["tail"]:
        lt = sum("data-florilegium-tail=" in t for t in pages.values())
        if lt != len(chs) - quiet:
            problems.append(f"живых концовок {lt}, а нужно {len(chs) - quiet} (перед шмуцтитулом с садом — только виньетка)")
    detail = f"заставок {heads}, буквиц {inits}, концовок {tails}" + (f"; живые, перед шмуцтитулом только виньетка: {quiet}" if live else "")
    rep.add("FAIL" if problems else "OK", name, fmt, f"сады в главах: {len(chs)}", "; ".join(problems[:3]) or detail)
    if cg["initials"] and inits < len(chs):
        rep.add("WARN", name, fmt, f"буквицы: {inits} из {len(chs)}",
                "остальные главы начинаются не с буквы (тире реплики, разметка) — там буквицы нет")
    if not live or problems:
        return
    node = shutil.which("node")
    js_name = next((n for n in names if n.endswith("js/florilegium-garden.js")), None)
    if not node or not js_name:
        rep.add("WARN", name, fmt, "сады в главах: движок не прогнан", "нет node — проверьте страницы в читалке")
        return
    with zipfile.ZipFile(path) as z:
        js = z.read(js_name).decode("utf-8")
    seed = int(re.search(r'data-florilegium-(?:band|tail)="(\d+)', next(iter(pages.values()))).group(1))
    probe = "var window = {};\n" + js + ("\n;(function () { var F = window.FlorilegiumGarden, s = %d, out = [];\n"
             "out.push(F.band({ seed: s, width: 114, height: 80 }).length);\n"
             "out.push(F.tailgarden({ seed: s, width: 114, height: 60 }).length);\n"
             "out.push(F.vignette({ seed: s }).length, F.tile({ seed: s }).length);\n"
             "console.log(JSON.stringify(out)); })();\n") % seed
    with tempfile.TemporaryDirectory() as td:
        f = Path(td, "probe.js")
        f.write_text(probe, encoding="utf-8")
        r = subprocess.run([node, str(f)], capture_output=True, text=True, timeout=300)
    if r.returncode:
        tail = ((r.stderr or r.stdout).strip().splitlines() or ["?"])[-1]
        rep.add("FAIL", name, fmt, "сады в главах: движок упал", tail[:200])
        return
    sizes = json.loads(r.stdout.strip().splitlines()[-1])
    thin = [k for k, v in zip(("заставка", "сад в конце", "виньетка", "плитка"), sizes) if v < (50000 if k in ("заставка", "сад в конце") else 3000)]
    rep.add("FAIL" if thin else "OK", name, fmt, "сады в главах: движок растит заставку, сад, виньетку, плитку",
            ("пустые: " + ", ".join(thin)) if thin else f"seed {seed}")


def check_modes(config_path: str, rep: Report):
    """Режимы одной книги должны различаться только служебными слоями.

    Проза обязана совпадать слово в слово: если рабочая сборка несёт
    правку, которой нет в читательской, значит режимы разъехались.
    """
    import json as _json
    modes = list(_json.loads(Path(config_path).read_text(encoding="utf-8"))
                 .get("modes") or {})
    if len(modes) < 2:
        return
    bodies = {}
    for m in modes:
        c = load_config(config_path, m)
        bodies[m] = [md_plain(ch["body"]) for ch in chapters_clean(c)]
    first, *rest = modes
    for m in rest:
        a_, b_ = bodies[first], bodies[m]
        if len(a_) != len(b_):
            rep.add("FAIL", f"режимы {first}/{m}", "", "разное число глав",
                    f"{len(a_)} против {len(b_)}")
            continue
        diff = [i for i, (x, y) in enumerate(zip(a_, b_)) if x != y]
        rep.add("FAIL" if diff else "OK", f"режимы {first}/{m}", "",
                "проза совпадает слово в слово",
                f"расходятся главы: {diff[:5]}" if diff else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--mode")
    ap.add_argument("--all-modes", action="store_true")
    ap.add_argument("--gardens", action="store_true", help="режим с садом")
    ap.add_argument("--live", action="store_true", help="режим с живым садом")
    a = ap.parse_args()
    if a.live:
        a.gardens = True
    cfg = load_config(a.config, a.mode, a.gardens, a.live)
    outdir = cfg.path(cfg["output_dir"])
    rep = Report()
    if cfg.get("cover"):
        cp = cfg.path(cfg["cover"])
        rep.add("OK" if cp.exists() else "FAIL", "обложка", "", str(cp.name))
    else:
        rep.add("WARN", "обложка", "", "не задана — книга выйдет без обложки, в библиотеке читалки будет серый квадрат")
    if not cfg["annotation"]:
        rep.add("WARN", "аннотация", "", "не задана — в книге не будет страницы аннотации")
    if a.all_modes:
        import json as _json
        for m in (_json.loads(Path(a.config).read_text(encoding="utf-8"))
                  .get("modes") or {}):
            c = load_config(a.config, m, a.gardens, a.live)
            od = c.path(c["output_dir"])
            check_target(c, rep, c["basename"], od / c["basename"], c["formats"])
            for fr in c["fragments"]:          # фрагменты каждого режима — как в одиночной проверке
                check_target(c, rep, fr["basename"], od / fr["basename"], fr["formats"], fr["until"], fr)
        check_modes(a.config, rep)
        rep.print()
        print(f"\nИтого: {sum(1 for r in rep.rows if r[0] == 'OK')} ok, "
              f"{sum(1 for r in rep.rows if r[0] == 'WARN')} предупреждений, "
              f"{rep.fails} ошибок")
        sys.exit(1 if rep.fails else 0)

    check_target(cfg, rep, cfg["basename"], outdir / cfg["basename"], cfg["formats"])
    check_modes(a.config, rep)
    for fr in cfg["fragments"]:
        check_target(cfg, rep, fr["basename"], outdir / fr["basename"], fr["formats"], fr["until"], fr)
    rep.print()
    print(f"\nИтого: {sum(1 for r in rep.rows if r[0] == 'OK')} ok, "
          f"{sum(1 for r in rep.rows if r[0] == 'WARN')} предупреждений, {rep.fails} ошибок")
    sys.exit(1 if rep.fails else 0)


if __name__ == "__main__":
    main()
