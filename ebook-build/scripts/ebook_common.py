#!/usr/bin/env python3
"""
Общий модуль скилла ebook-build: настройки книги, чтение и очистка глав,
перевод упрощённого Markdown в XHTML (ePub) и FB2, извлечение текста
из готовых файлов для проверок.

Все пути в book.json считаются от папки, где лежит сам book.json.
Поэтому комплект проекта переносим: скрипты не знают абсолютных путей.
"""

from __future__ import annotations

import copy
import glob
import html
import json
import re
import zipfile
from pathlib import Path

# ───────────────────────── тексты по умолчанию ─────────────────────────

TEXTS = {
    "ru": {
        "annotation": "Аннотация",
        "title_page": "Титул",
        "colophon": "Колофон",
        "contents": "Оглавление",
        "built": "собрано",
        "series_line": "цикл «{series}»",
        "continued": "ПРОДОЛЖЕНИЕ СЛЕДУЕТ",
        "fragment_label": "читательский фрагмент",
        "fragment_title_suffix": " — фрагмент",
        "fragment_end": "На этом фрагмент заканчивается.",
        "foreword": "От автора",
        "stub_banner": "ГЛАВА ЕЩЁ НЕ НАПИСАНА",
        "stub_progress": "Проработано в замысле",
        "stub_sources": "Опоры",
        "note_version": "Версия",
        "note_status": "Статус",
        "note_pov": "POV",
        "note_loc": "Локация",
        "prose": "проза",
        "stub_short": "плашка",
    },
    "en": {
        "annotation": "About this book",
        "title_page": "Title page",
        "colophon": "Colophon",
        "contents": "Contents",
        "built": "built",
        "series_line": "{series} series",
        "continued": "TO BE CONTINUED",
        "fragment_label": "reader's excerpt",
        "fragment_title_suffix": " — excerpt",
        "fragment_end": "This is the end of the excerpt.",
        "foreword": "From the author",
        "stub_banner": "THIS CHAPTER IS NOT WRITTEN YET",
        "stub_progress": "Planned",
        "stub_sources": "Sources",
        "note_version": "Version",
        "note_status": "Status",
        "note_pov": "POV",
        "note_loc": "Location",
        "prose": "prose",
        "stub_short": "stub",
    },
}

# Служебные пометки, которые никогда не должны попасть в книгу.
# Блоки вырезаются в любом месте главы, хвостовые — только в самом конце
# (сколько бы их ни стояло подряд).
DEFAULT_STRIP_BLOCKS = [
    r"\*\((?:версия|монтаж|version|draft)\b.*?\)\*",   # *(версия 1.3: …)*
    r"<!--.*?-->",                                     # html-комментарии
    # Шапка рабочей версии целым абзацем: *(Книга 2 «…». **Рабочая версия 0.1** — …)*
    # и тот же вид без скобок. Конец — у края абзаца, а не на первой «)*»
    # внутри: в шапках бывают вложенные скобки и полужирный.
    r"(?m)^\*\((?:Книга|Book)\s+\d+\s+«[^»\n]*»\.(?:(?!\n[ \t]*\n).)*?\)\*[ \t]*$",
    r"(?m)^\*(?:Книга|Book)\s+\d+\s+«[^»\n]*»\.(?:(?!\n[ \t]*\n).)*?\*[ \t]*$",
]
# Голая нумерация сцен внутри главы: «## I», «## IV.», «## 3».
# Не удаляется, а заменяется отбивкой: иначе сцены склеиваются.
DEFAULT_BARE_SECTION = r"(?m)^[ \t]*#{1,6}[ \t]*(?:[IVXLCDM]+|\d{1,2})[.)]?[ \t]*$"

# Хвостовые пометки. Проверяются построчно и только целой строкой:
# «…это был конец главы его жизни.» в прозе под правило не попадает.
DEFAULT_STRIP_TRAILING = [
    r"\*\*(?:КОНЕЦ (?:ГЛАВЫ[^*]*|ПРОЛОГА|ЭПИЛОГА|ЧАСТИ[^*]*)|END OF (?:CHAPTER[^*]*|PROLOGUE|EPILOGUE))\*\*",
    r"\*{0,2}КОНЕЦ (?:ГЛАВЫ|ПРОЛОГА|ЭПИЛОГА|ЧАСТИ)[^*\n]*\*{0,2}",   # *КОНЕЦ ГЛАВЫ*, КОНЕЦ ГЛАВЫ 18
    r"\*{0,2}\[\s*Конец\s+(?:гл\.|главы|пролога|эпилога)[^\]\n]*\]\*{0,2}",   # *[Конец гл. 1, v0.42]*
    r"\*{0,2}\(\s*Конец\s+(?:гл\.|главы|пролога|эпилога)[^)\n]*\)\*{0,2}",    # *(Конец главы.)*
]
# Служебный раздел в конце файла: с этой строки и до конца всё отрезается.
DEFAULT_CUT_FROM = [
    r"^#{1,6}\s*Заметки редактора",
]
# Строка, целиком состоящая из разделителя, — отбивка сцены.
SEPARATOR_LINE = (r"(?m)^[ \t]*(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|⸻+)[ \t]*$")

# Что считается утечкой в готовой книге (проверяется verify_book.py).
DEFAULT_LEAKS = [
    r"КОНЕЦ ГЛАВЫ", r"КОНЕЦ ПРОЛОГА", r"КОНЕЦ ЭПИЛОГА", r"END OF CHAPTER",
    r"\(версия\s", r"\(монтаж\s", r"<!--", r"\bTODO\b", r"\bFIXME\b",
    r"\*\*", r"(?<![\w*])\*(?=\w)", r"!\[", r"\]\(", r"(?m)^#{1,6} ",
    # Рабочие шапки и концовки в любом виде.
    r"Рабочая версия", r"\((?:Книга|Book) \d+ «", r"\bPOV\b", r"по архитектуре v\d", r"§\s?\d",
    r"(?i)\[\s*конец\s+(?:гл\.|главы)", r"(?i)\(\s*конец\s+(?:гл\.|главы)",
    r"Заметки редактора",
    # Отбивка, прилипшая к абзацу, выходит в книгу видимым текстом.
    r"(?:^|\s)-{3,}(?:\s|$)",
    # Сырой заголовок посреди текста: после снятия тегов он стоит не в начале строки.
    r"(?:^|\s)#{1,6} \S",
]

# Поле «версия» для плашки главы — из снятой шапки.
VERSION_RE = r"(?:Рабочая\s+)?(?:верси[яи]|version)\s*v?(\d+(?:\.\d+)+)"


# ───────────────────────── настройки ─────────────────────────

# Шмуцтитул с садом (florilegium). Координаты — в мм холста картинки сада:
# название стоит в пустом углу, который генератор оставляет над концом
# «текстового блока». Значения — под make_gardens.py с его параметрами по умолчанию.
GARDEN_LAYOUT = {
    "canvas": [121, 201],       # мм; картинка растягивается на этот холст
    "x": 69.1,                  # центр названия
    "label_y": 56.1, "label_size": 4.8, "label_spacing": 1.0,
    "rule_y": 61.6, "rule_half": 6, "rule_color": "#B4662F",
    "name_y": 70.1, "name_size": 4.0, "name_opacity": 0.75,
}


def part_garden(cfg: "Config", part: dict) -> dict | None:
    """Сад части — только в режиме с садом. В спокойной сборке None,
    даже если поле garden у части заполнено."""
    return part.get("garden") if cfg.get("gardens") else None


# Живой сад: движок florilegium, портированный на JS (детерминированная математика,
# тот же сад, что у генератора, байт в байт), и скрипт шмуцтитула в одном файле.
GARDEN_LIVE_JS = Path(__file__).resolve().parent / "florilegium-garden.js"
GARDEN_GEN_DEFAULTS = {"ink": "2456C4", "accent": "B4662F", "theme": "flora", "season": "summer", "novisitors": False}


def garden_gen(cfg: "Config") -> dict:
    """Параметры генератора садов (garden_generator в book.json) — общие
    для make_gardens.py и живого сада."""
    return {**GARDEN_GEN_DEFAULTS, **(cfg.get("garden_generator") or {})}


def garden_seed_data(cfg: "Config", seed: int) -> str:
    """«seed ink accent season [novisitors]» — данные живого сада для скрипта страницы."""
    gen = garden_gen(cfg)
    out = [str(int(seed)), str(gen["ink"]).lstrip("#"), str(gen["accent"]).lstrip("#"), str(gen["season"])]
    if gen.get("novisitors"):
        out.append("novisitors")
    return " ".join(out)


def garden_live_data(cfg: "Config", part: dict) -> str | None:
    """Строка data-florilegium для живого сада части: «seed ink accent season [novisitors]».
    None — у части нет seed или живой режим выключен."""
    g = part_garden(cfg, part)
    if not cfg.get("gardens_live") or not g or "seed" not in g:
        return None
    return garden_seed_data(cfg, g["seed"])


# ───────── сады в главах: заставка, буквица, концовка ─────────
# Включаются ключом chapter_gardens в режиме с садом. Картинки рисует
# make_gardens.py (движок на JS, node), сборка только берёт готовые.
CHAPTER_GARDEN_DEFAULTS = {"head": True, "initials": True, "tail": True,
                           "seed_base": 100, "dir": "gardens/chapters", "seeds": {}}
INITIAL_RE = re.compile(r"^((?:[«„“\"]\s?)?)([A-Za-zА-Яа-яЁё])")


def chapter_garden(cfg: "Config", ch: dict, force: bool = False) -> dict | None:
    """Украшения главы: seed и пути картинок (head, tail, initial; None — выключено).
    None для плашки и вне режима с садом (force — для make_gardens.py)."""
    cg = cfg.get("chapter_gardens")
    if not cg or ch.get("stub") or not (force or cfg.get("gardens")):
        return None
    ids = [c["id"] for c in cfg["_chapters"]]
    k = ids.index(ch["id"]) + 1
    seed = int(cg["seeds"].get(ch["id"], cg["seed_base"] + k))
    slug = re.sub(r"[^\w.-]+", "_", Path(ch["id"]).stem)
    base = f'{cg["dir"].rstrip("/")}/{k:02d}_{slug}'
    return {"seed": seed, "k": k,
            "head": f"{base}_head.png" if cg["head"] else None,
            "tail": f"{base}_tail.png" if cg["tail"] else None,
            "initial": f"{base}_initial.png" if cg["initials"] else None}


def chapters_before_garden_parts(cfg: "Config", items: list[tuple]) -> set[str]:
    """Главы, за которыми сразу идёт шмуцтитул с садом. В конце таких глав —
    только виньетка, без живой полосы: иначе на развороте два сада подряд."""
    out, last = set(), None
    for it in items:
        if it[0] == "chapter":
            last = it[1]["id"]
        else:
            if last and part_garden(cfg, it[1]):
                out.add(last)
            last = it[2][-1]["id"] if it[2] else last
    return out


def add_initial(body: str, style: str) -> tuple[str, str | None]:
    """Буквица: первая буква первого абзаца главы (не в цитате) — в плитку.
    Открывающая кавычка уходит в плитку вместе с буквой. Абзац, который
    начинается с тире, разметки или цифры, остаётся без буквицы.
    Возвращает новый HTML и букву (None — буквицы нет)."""
    for m in re.finditer(r"<p>", body):
        before = body[:m.start()]
        if before.count("<blockquote") != before.count("</blockquote"):
            continue
        rest = body[m.end():]
        mm = INITIAL_RE.match(rest)
        if not mm:
            return body, None
        q, letter = mm.group(1), mm.group(2)
        qhtml = f'<span class="initial-q">{q.strip()}</span>' if q else ""
        span = f'<span class="initial" style="{style}">{qhtml}{letter}</span>'
        return body[:m.start()] + '<p class="first">' + span + rest[mm.end():], letter
    return body, None


def garden_svg(cfg: "Config", href: str, label: str, name: str, live: str | None = None) -> str:
    """Шмуцтитул части с садом: картинка и название в одной SVG-обёртке.

    Вписывание без обрезки (meet): Apple Books держит свои поля, и обрезка
    резала бы сад посреди страницы; у сада прозрачный фон, так что пустое
    место вокруг невидимо в любой теме. Название — живой текст цвета текста
    читалки (currentColor), чтобы не пропадало в тёмных темах.
    Регистр атрибутов (viewBox, preserveAspectRatio) важен: в XHTML
    viewbox — это другой, несуществующий атрибут.

    live — живой сад (data-florilegium): скрипт страницы выращивает сад
    с тем же seed под формат экрана и заменяет им картинку; классы flo-*
    говорят ему, что двигать. Без скрипта страница та же, что статичная.
    """
    gl = cfg["garden_layout"]
    w, h = gl["canvas"]
    x = gl["x"]
    e = lambda s: html.escape(s, quote=True)
    aria = ". ".join(t for t in (label, name) if t)
    top, sub = (label, name) if label else (name, "")
    cl = (lambda c: f'class="{c}" ') if live else (lambda c: "")   # классы — только для скрипта живого сада
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"'
           f' width="100%" height="100%" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet"'
           f' role="img" aria-label="{e(aria)}"' + (f' data-florilegium="{e(live)}"' if live else "") + '>',
           f'<image width="{w}" height="{h}" xlink:href="{e(href)}"/>',
           '<g font-family="serif" text-anchor="middle">',
           f'<text {cl("flo-label")}x="{x}" y="{gl["label_y"]}" font-size="{gl["label_size"]}" '
           f'letter-spacing="{gl["label_spacing"]}" fill="currentColor">{e(top)}</text>',
           f'<line {cl("flo-rule")}x1="{x - gl["rule_half"]}" x2="{x + gl["rule_half"]}" y1="{gl["rule_y"]}" y2="{gl["rule_y"]}" '
           f'stroke="{gl["rule_color"]}" stroke-width="0.3"/>']
    if sub:
        out.append(f'<text {cl("flo-name")}x="{x}" y="{gl["name_y"]}" font-size="{gl["name_size"]}" fill="currentColor" '
                   f'fill-opacity="{gl["name_opacity"]}">{e(sub)}</text>')
    out.append("</g></svg>")
    return "\n".join(out)


class Config(dict):
    """book.json + вычисленные поля. base — папка конфига."""

    @property
    def base(self) -> Path:
        return self["_base"]

    def path(self, rel: str | None) -> Path | None:
        if not rel:
            return None
        p = Path(rel)
        return p if p.is_absolute() else (self.base / p)

    def text(self, key: str) -> str:
        return self["texts"][key]


def deep_merge(base: dict, over: dict) -> dict:
    """Переопределения режима поверх базовых настроек. Словари сливаются,
    остальное заменяется целиком."""
    out = copy.deepcopy(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def load_config(path: str | Path, mode: str | None = None, gardens: bool | None = None,
                live: bool | None = None) -> Config:
    path = Path(path).resolve()
    raw = json.loads(path.read_text(encoding="utf-8"))

    # Режимы: одна книга, две сборки — читательская и рабочая.
    # modes.<имя> переопределяет поля верхнего уровня.
    modes = raw.get("modes") or {}
    if mode is None:
        mode = raw.get("default_mode") or (next(iter(modes)) if modes else None)
    if modes:
        if mode not in modes:
            raise SystemExit(f"book.json: неизвестный режим «{mode}». "
                             f"Есть: {', '.join(modes)}")
        raw = deep_merge(raw, modes[mode])
    raw.pop("modes", None)

    cfg = Config(raw)
    cfg["_base"] = path.parent
    cfg["_file"] = path
    cfg["_mode"] = mode

    for req in ("title", "author", "basename"):
        if not cfg.get(req):
            raise SystemExit(f"book.json: не задано обязательное поле «{req}»")

    lang = cfg.setdefault("language", "ru")
    texts = copy.deepcopy(TEXTS.get(lang[:2], TEXTS["en"]))
    texts.update(cfg.get("texts", {}))
    cfg["texts"] = texts

    cfg.setdefault("output_dir", "books")
    cfg.setdefault("formats", ["epub", "fb2", "mobi"])
    cfg.setdefault("parts", [])
    cfg.setdefault("fragments", [])
    cfg.setdefault("genres_fb2", ["prose_contemporary"])
    sm = cfg.setdefault("service_markers", {})
    sm.setdefault("strip_blocks", DEFAULT_STRIP_BLOCKS)
    sm.setdefault("strip_trailing", DEFAULT_STRIP_TRAILING)
    sm.setdefault("bare_sections", True)
    sm.setdefault("cut_from", DEFAULT_CUT_FROM)
    # extra_* добавляются к дефолтам: заменять весь список ради одной
    # пометки опасно — вместе с ним теряются все стандартные правила.
    for k in ("blocks", "trailing", "cut_from"):
        extra = sm.get(f"extra_{k}") or []
        key = "cut_from" if k == "cut_from" else f"strip_{k}"
        sm[key] = list(sm[key]) + [x for x in extra if x not in sm[key]]
    cfg.setdefault("leak_patterns", [])
    cfg.setdefault("leak_ignore", [])          # дефолтные утечки, законные для этой книги
    cfg.setdefault("titles", {})
    cfg.setdefault("title_subtitle", "keep")   # keep | merge — «# ГЛАВА 20» + «## Облигации»
    cfg.setdefault("numbering", {})
    cfg.setdefault("md", {})
    cfg.setdefault("chapter_notes", {})        # {"enabled": true} — плашка главы (рабочий режим)
    cfg.setdefault("chapter_meta", {})         # {id: {"status", "pov", "loc", "version"}}
    cfg.setdefault("must_contain", [])         # контрольные фразы автора
    if cfg.get("foreword_file") and not cfg.get("foreword"):
        cfg["foreword"] = cfg.path(cfg["foreword_file"]).read_text(encoding="utf-8")

    # аннотация: список абзацев или файл
    if not cfg.get("annotation") and cfg.get("annotation_file"):
        cfg["annotation"] = read_annotation_file(cfg.path(cfg["annotation_file"]))
    cfg.setdefault("annotation", [])

    cfg["_chapters"] = resolve_chapters(cfg)
    ids = [c["id"] for c in cfg["_chapters"]]
    for part in cfg["parts"]:
        for ch in part.get("chapters", []):
            if ch not in ids:
                raise SystemExit(f"book.json: часть «{part.get('name') or part.get('label')}» "
                                 f"ссылается на неизвестную главу «{ch}»")
    # Сады на шмуцтитулах частей — отдельный режим, по умолчанию выключен:
    # спокойная книга собирается как раньше, поле garden у частей ни на что
    # не влияет, и отсутствие картинок ей не мешает. Включается ключом
    # "gardens": true (обычно в modes) или флагом --gardens. Садовая сборка
    # получает к имени суффикс, чтобы не перезаписать спокойную.
    if gardens:
        cfg["gardens"] = True
    cfg.setdefault("gardens", False)
    cfg.setdefault("gardens_suffix", "_сад")
    # Живой сад — подрежим садовой сборки: на шмуцтитуле сад перерастает
    # под формат экрана читалки (скрипт в ePub). Без режима с садом не действует.
    cfg["gardens_live"] = bool(cfg["gardens"] and (live or cfg.get("gardens_live")))
    gl = dict(GARDEN_LAYOUT)
    gl.update(cfg.get("garden_layout") or {})
    cfg["garden_layout"] = gl
    for part in cfg["parts"]:
        if isinstance(part.get("garden"), str):
            part["garden"] = {"image": part["garden"]}
    cg = cfg.get("chapter_gardens")
    cfg["chapter_gardens"] = {**CHAPTER_GARDEN_DEFAULTS, **(cg if isinstance(cg, dict) else {})} if cg else None
    if cfg["gardens"]:
        with_g = [p for p in cfg["parts"] if p.get("garden")]
        if not with_g and not cfg["chapter_gardens"]:
            raise SystemExit("book.json: включён режим с садом, но ни у одной части нет поля garden и нет chapter_gardens")
        for part in with_g:
            g = part["garden"]
            gp = cfg.path(g.get("image"))
            if not gp or not gp.exists():
                raise SystemExit(f"book.json: сад для части «{part.get('label') or part.get('name')}» "
                                 f"не найден: {g.get('image')}. Сгенерируйте его: make_gardens.py --config …")
            if gp.suffix.lower() not in (".png", ".jpg", ".jpeg"):
                raise SystemExit(f"book.json: сад «{g.get('image')}» — нужен PNG или JPEG")
        if cfg.get("chapter_gardens"):
            missing = []
            for ch in cfg["_chapters"]:
                cgd = chapter_garden(cfg, ch)
                for key in ("head", "tail", "initial"):
                    if cgd and cgd[key] and not cfg.path(cgd[key]).exists():
                        missing.append(cgd[key])
            if missing:
                raise SystemExit(f"book.json: нет картинок садов для глав ({len(missing)}), например {missing[0]}. "
                                 "Сгенерируйте их: make_gardens.py --config …")
        if cfg["gardens_live"]:
            if garden_gen(cfg)["theme"] not in ("flora", ""):
                raise SystemExit("book.json: живой сад умеет только тему flora (garden_generator.theme)")
            if not GARDEN_LIVE_JS.exists():
                raise SystemExit(f"живой сад: нет движка {GARDEN_LIVE_JS.name} рядом со скриптами скилла")
            if not any("seed" in p["garden"] for p in with_g) and not cfg["chapter_gardens"]:
                raise SystemExit("book.json: живому саду нужен seed хотя бы у одной части или сады в главах")
        sfx = cfg["gardens_suffix"]
        if sfx and not cfg["basename"].endswith(sfx):
            cfg["basename"] += sfx
    for fr in cfg["fragments"]:
        if fr.get("until") not in ids:
            raise SystemExit(f"book.json: фрагмент ссылается на неизвестную главу «{fr.get('until')}»")
        fr.setdefault("formats", ["epub"])
        sfx = cfg["gardens_suffix"]
        if cfg["gardens"] and sfx and fr.get("basename") and not fr["basename"].endswith(sfx):
            fr["basename"] += sfx
    return cfg


def read_annotation_file(p: Path) -> list[str]:
    """Абзацы аннотации из .md/.txt. Если в файле есть заголовок
    «Аннотация»/«Annotation», берётся только его раздел."""
    t = p.read_text(encoding="utf-8")
    m = re.search(r"^#+\s*(?:Аннотация|Annotation|About this book)\s*$(.*?)(?=^#+\s|\Z)",
                  t, re.M | re.S | re.I)
    if m:
        t = m.group(1)
    paras = [re.sub(r"\s+", " ", b).strip() for b in re.split(r"\n\s*\n", t)]
    return [p for p in paras if p and not p.startswith("#") and not p.startswith("---")]


def resolve_chapters(cfg: Config) -> list[dict]:
    """Порядок глав: явный список > glob > один файл с разбиением по H1."""
    chdir = cfg.path(cfg.get("chapters_dir", "."))
    out = []
    if cfg.get("source_file"):
        text = cfg.path(cfg["source_file"]).read_text(encoding="utf-8")
        pieces = re.split(r"(?m)^(?=# )", text)
        n = 0
        for piece in pieces:
            if piece.strip().startswith("# "):
                n += 1
                out.append({"id": f"{n:02d}", "path": None, "raw": piece})
        if not out:
            raise SystemExit("source_file: не найдено ни одного заголовка «# »")
        return out
    names = cfg.get("chapters")
    if not names:
        pattern = cfg.get("chapters_glob", "*.md")
        names = sorted(Path(p).name for p in glob.glob(str(chdir / pattern)))
    for name in names:
        if isinstance(name, dict):
            # Плашка-пропуск: главы ещё нет, на её месте — описание замысла.
            if not name.get("stub"):
                raise SystemExit(f"book.json: запись главы без файла должна иметь поле «stub»: {name}")
            sid = name.get("id") or "stub-" + re.sub(r"\W+", "-", name["stub"].lower()).strip("-")
            out.append({"id": sid, "path": None, "raw": None, "stub": name})
            continue
        p = chdir / name
        if not p.exists():
            raise SystemExit(f"Глава не найдена: {p}")
        out.append({"id": name, "path": p, "raw": None})
    if not out:
        raise SystemExit(f"Не найдено ни одной главы в {chdir}")
    return out


# ───────────────────────── главы ─────────────────────────

def out_path(base: Path, ext: str) -> Path:
    """Путь к готовому файлу. Не Path.with_suffix: в имени «…_бета_2.0» он
    принимает «.0» за расширение и пишет «…_бета_2.epub»."""
    return base.parent / f"{base.name}.{ext.lstrip('.')}"


def chapter_raw(ch: dict) -> str:
    if ch.get("stub"):
        return f"# {ch['stub']['stub']}\n"
    return ch["raw"] if ch["raw"] is not None else ch["path"].read_text(encoding="utf-8")


def _is_trailing_marker(line: str, pats: list[str]) -> bool:
    s = line.strip()
    if not s:
        return False
    if re.fullmatch(r"---", s):
        return True
    return any(re.fullmatch(p, s, flags=re.I) for p in pats)


def clean_chapter(raw: str, cfg: Config, info: dict | None = None) -> tuple[str, str]:
    """Возвращает (заголовок, тело) без служебных пометок.

    Порядок важен:
      1. Служебный хвост-раздел (cut_from) — отрезается целиком до конца файла.
      2. H1. Если их несколько подряд в начале («# Книга 2 — §1.1.Д» /
         «# ПРЕДЛОЖЕНИЕ…»), заголовком становится последний, остальные
         уходят в info["dropped_h1"] — сборка предупредит.
      3. Шапки (strip_blocks) — их текст уходит в info["service"], из него
         берётся версия для плашки рабочего режима.
      4. Подзаголовок сразу под H1 при title_subtitle = merge.
      5. Разделители «***», «* * *», «⸻», «-----» приводятся к «---»;
         голая нумерация сцен («## IV») тоже становится «---».
      6. Отбивка в начале главы снимается, две отбивки подряд — сливаются
         (иначе «---» и «## II» дают двойную черту).
      7. Хвост: все подряд стоящие концовки и висящие отбивки, построчно и
         только целой строкой. Финальная строка книги сохраняется.
    """
    info = info if info is not None else {}
    sm = cfg["service_markers"]
    raw = raw.replace("\r\n", "\n")

    for pat in sm.get("cut_from") or []:
        m = re.search(pat, raw, flags=re.M | re.I)
        if m:
            info.setdefault("cut", []).append(raw[m.start():m.start() + 60].split("\n")[0])
            raw = raw[:m.start()]

    lines = raw.split("\n")
    title, h1s = "", []
    for i, line in enumerate(lines):
        if line.startswith("# "):
            j = i
            while j < len(lines) and (lines[j].startswith("# ") or not lines[j].strip()):
                if lines[j].startswith("# "):
                    h1s.append(lines[j][2:].strip())
                j += 1
            title = h1s[-1]
            lines = lines[j:]
            break
    info["dropped_h1"] = h1s[:-1]
    body = "\n".join(lines)

    service = []
    for pat in sm["strip_blocks"]:
        service += [m.group(0) for m in re.finditer(pat, body, flags=re.S | re.I)]
        body = re.sub(pat, "", body, flags=re.S | re.I)
    info["service"] = service
    vers = [m.group(1) for t in service for m in [re.search(VERSION_RE, t, re.I)] if m]
    info["version"] = vers[0] if vers else None

    if cfg.get("title_subtitle") == "merge":
        m = re.match(r"\s*##[ \t]+(.+?)[ \t]*\n", body + "\n")
        bare = sm.get("bare_sections", True)
        bare_pat = DEFAULT_BARE_SECTION if bare is True else bare
        if m and not (bare and re.fullmatch(bare_pat, "## " + m.group(1))):
            info["subtitle"] = m.group(1).strip()
            body = body[m.end():]

    # Отбивка всегда отдельным блоком: «## III» или «***» сразу под строкой
    # прозы без пустой строки иначе прилипает к абзацу и выходит в книгу
    # видимым «---» — мимо подсчёта отбивок и проверки утечек.
    body = re.sub(SEPARATOR_LINE, "\n\n---\n\n", body)
    if sm.get("bare_sections", True):
        pat = sm.get("bare_sections")
        pat = DEFAULT_BARE_SECTION if pat is True else pat
        body = re.sub(pat, "\n\n---\n\n", body)

    blocks_ = [b.strip() for b in re.split(r"\n[ \t]*\n", body) if b.strip()]
    merged = []
    for b in blocks_:
        if b == "---" and (not merged or merged[-1] == "---"):
            continue
        merged.append(b)
    body = "\n\n".join(merged)

    final = cfg.get("final_line")
    final_md = f"**{final}**" if final else None
    has_final = bool(final_md and body.rstrip().endswith(final_md))
    if has_final:
        body = body.rstrip()[: -len(final_md)]
    trail = sm["strip_trailing"]
    lines = body.rstrip().split("\n")
    removed = []
    while lines and (not lines[-1].strip() or _is_trailing_marker(lines[-1], trail)):
        if lines[-1].strip() and lines[-1].strip() != "---":
            removed.append(lines[-1].strip())
        lines.pop()
    info["trailing"] = removed
    body = "\n".join(lines).strip()
    if has_final:
        body += "\n\n" + final_md
    return title, body


DEFAULT_NUM_PATTERN = r"^Глава\s+\d+[А-ЯЁA-Z]?\.\s*(?P<name>.+)$"
DEFAULT_NUM_TEMPLATE = "Глава {n}. {name}"


def chapters_clean(cfg: Config) -> list[dict]:
    """Главы с очищенным телом и окончательными заголовками.

    Заголовок берётся из H1 файла, но его могут перебить:
      • titles — публичное название вместо рабочего (файл не трогаем);
      • numbering — сквозной счёт по порядку чтения вместо рабочих слотов
        («Глава 13В. День в деревне» → «Глава 21. День в деревне»).
    Нумеруются только главы, чей заголовок подошёл под pattern: пролог,
    эпилоги и всё, названное одним словом, остаются как есть.
    """
    num = cfg.get("numbering") or {}
    enabled = bool(num.get("enabled"))
    pattern = re.compile(num.get("pattern", DEFAULT_NUM_PATTERN))
    template = num.get("template", DEFAULT_NUM_TEMPLATE)
    start = int(num.get("start", 1))

    res, seq = [], start - 1
    for ch in cfg["_chapters"]:
        info: dict = {}
        if ch.get("stub"):
            t, b = ch["stub"]["stub"], ""
        else:
            t, b = clean_chapter(chapter_raw(ch), cfg, info)
        src_title = t or ch["id"]
        if info.get("subtitle"):
            src_title = f"{src_title.rstrip('.:')}. {info['subtitle']}"
        title = cfg["titles"].get(ch["id"], src_title)
        renamed = _title_key(title) != _title_key(src_title) and not ch.get("stub")
        if enabled:
            m = pattern.match(title)
            if m:
                seq += 1
                title = template.format(n=seq, name=m.group("name"))
        res.append({**ch, "title": title, "source_title": src_title,
                    "renamed": renamed, "body": b, "info": info,
                    "note": chapter_note(cfg, ch, info)})
    return res


def _title_key(t: str) -> str:
    """Заголовок без регистра, кавычек и знаков: «ГЛАВА 13: «СКЛАДНИК»» и
    «Глава 13. Складник» — одно имя, предупреждать не о чем."""
    return re.sub(r"\s+", " ", re.sub(r"[«»\"'“”„:.,!?—–-]", " ", t)).strip().casefold()


def chapter_note(cfg: Config, ch: dict, info: dict) -> dict | None:
    """Плашка главы для рабочего режима: версия, статус, POV, локация.

    Версия берётся из шапки файла — она там всегда свежая. Если в
    chapter_meta вписана другая, плашка показывает версию из файла, а
    сборка предупреждает: ручные номера отстают от текста.
    """
    if ch.get("stub") or not (cfg.get("chapter_notes") or {}).get("enabled"):
        return None
    meta = dict((cfg.get("chapter_meta") or {}).get(ch["id"], {}))
    auto = info.get("version")
    manual = meta.get("version")
    if auto:
        meta["version"] = "v" + auto
    if manual and auto and manual.lstrip("vV") != auto:
        meta["_version_mismatch"] = f"в chapter_meta {manual}, в шапке файла v{auto}"
    return meta


def blocks(md: str) -> list[str]:
    return [b.strip() for b in re.split(r"\n\s*\n", md.strip()) if b.strip()]


def inline_html(s: str, em="em", strong="strong") -> str:
    s = html.escape(s, quote=False)
    # ***полужирный курсив*** — первым: иначе «**» съедает две звезды из трёх
    # и теги ложатся крест-накрест (<strong><em>x</strong></em>), FB2 ломается.
    s = re.sub(r"\*\*\*(.+?)\*\*\*", rf"<{strong}><{em}>\1</{em}></{strong}>", s, flags=re.S)
    s = re.sub(r"\*\*(.+?)\*\*", rf"<{strong}>\1</{strong}>", s, flags=re.S)
    s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", rf"<{em}>\1</{em}>", s, flags=re.S)
    return s


def md_to_xhtml(md: str, final_line: str | None = None) -> str:
    out = []
    for b in blocks(md):
        if b == "---":
            out.append('<hr class="sep"/>')
        elif final_line and b == f"**{final_line}**":
            out.append(f'<p class="theend">{html.escape(final_line)}</p>')
        elif b.startswith("## "):
            out.append(f"<h2>{inline_html(b[3:].strip())}</h2>")
        elif b.startswith("### "):
            out.append(f"<h3>{inline_html(b[4:].strip())}</h3>")
        elif all(l.startswith(">") for l in b.split("\n")):
            inner = "\n".join(l[1:].lstrip() for l in b.split("\n"))
            out.append(f"<blockquote><p>{inline_html(inner).replace(chr(10), '<br/>')}</p></blockquote>")
        else:
            out.append(f"<p>{inline_html(b).replace(chr(10), '<br/>')}</p>")
    return "\n".join(out)


def md_to_fb2(md: str, final_line: str | None = None) -> str:
    out = []
    for b in blocks(md):
        if b == "---":
            out.append("<empty-line/>\n<p><emphasis>* * *</emphasis></p>\n<empty-line/>")
        elif final_line and b == f"**{final_line}**":
            out.append(f"<empty-line/>\n<subtitle>{html.escape(final_line)}</subtitle>")
        elif b.startswith("## "):
            out.append(f"<subtitle>{inline_html(b[3:].strip(), 'emphasis')}</subtitle>")
        elif b.startswith("### "):
            out.append(f"<subtitle>{inline_html(b[4:].strip(), 'emphasis')}</subtitle>")
        elif all(l.startswith(">") for l in b.split("\n")):
            ps = "".join(f"<p>{inline_html(l[1:].lstrip(), 'emphasis')}</p>" for l in b.split("\n") if l[1:].strip())
            out.append(f"<cite>{ps}</cite>")
        else:
            for line in inline_html(b, "emphasis").split("\n"):
                if line.strip():
                    out.append(f"<p>{line.strip()}</p>")
    return "\n".join(out)


# Служебные вставки рабочей сборки. Каждая обёрнута в элемент с классом
# или id «svc-…», и verify_book.py вырезает их до всех проверок прозы:
# в утечки и в число слов они не попадают.

SVC_EPUB_RE = r'<div class="svc-[a-z]+">.*?</div>\s*<!--/svc-->'
SVC_FB2_RE = r'<cite id="svc-[^"]*">.*?</cite>'
SVC_MD_RE = r"<!-- (?:stub|note): .*?-->"


def _note_rows(cfg: Config, note: dict) -> list[tuple[str, str]]:
    keys = [("version", "note_version"), ("status", "note_status"),
            ("pov", "note_pov"), ("loc", "note_loc")]
    return [(cfg.text(t), str(note[k])) for k, t in keys if note.get(k)]


def note_xhtml(cfg: Config, note: dict | None) -> str:
    if not note:
        return ""
    rows = "".join(f"<tr><td class=\"k\">{html.escape(k)}</td><td>{html.escape(v)}</td></tr>"
                   for k, v in _note_rows(cfg, note))
    return f'<div class="svc-note"><table>{rows}</table></div><!--/svc-->' if rows else ""


def note_fb2(cfg: Config, note: dict | None, sid: str) -> str:
    if not note:
        return ""
    rows = "".join(f"<p>{html.escape(k)}: {html.escape(v)}</p>" for k, v in _note_rows(cfg, note))
    return f'<cite id="svc-note-{sid}">{rows}</cite>' if rows else ""


def stub_parts(cfg: Config, stub: dict) -> tuple[list[str], str]:
    """Строки плашки-пропуска: [(подпись, значение)…] и описание."""
    rows = []
    for k, t in (("pov", "note_pov"), ("loc", "note_loc")):
        if stub.get(k):
            rows.append(f"{cfg.text(t)}: {stub[k]}")
    if stub.get("progress") is not None:
        rows.append(f"{cfg.text('stub_progress')}: {int(stub['progress'])}%")
    return rows, stub.get("description", "")


def stub_xhtml(cfg: Config, stub: dict) -> str:
    rows, desc = stub_parts(cfg, stub)
    pct = int(stub.get("progress") or 0)
    meter = (f'<div class="meter"><div class="fill" style="width:{pct}%"></div></div>'
             if stub.get("progress") is not None else "")
    src = (f'<p class="src">{html.escape(cfg.text("stub_sources"))}: {html.escape(stub["sources"])}</p>'
           if stub.get("sources") else "")
    return (f'<div class="svc-stub"><p class="banner">{html.escape(cfg.text("stub_banner"))}</p>'
            + "".join(f"<p class=\"row\">{html.escape(r)}</p>" for r in rows) + meter
            + (f"<p>{html.escape(desc)}</p>" if desc else "") + src + "</div><!--/svc-->")


def stub_fb2(cfg: Config, stub: dict, sid: str) -> str:
    rows, desc = stub_parts(cfg, stub)
    ps = [cfg.text("stub_banner")] + rows + ([desc] if desc else [])
    if stub.get("sources"):
        ps.append(f"{cfg.text('stub_sources')}: {stub['sources']}")
    return f'<cite id="svc-stub-{sid}">' + "".join(f"<p>{html.escape(x)}</p>" for x in ps) + "</cite>"


def stub_md(cfg: Config, stub: dict) -> str:
    rows, desc = stub_parts(cfg, stub)
    return "<!-- stub: " + " | ".join([cfg.text("stub_banner")] + rows + [desc]).replace("--", "—") + " -->"


def foreword_text(cfg: Config, chapters: list[dict], d: str) -> tuple[str, str]:
    """(заголовок, тело md) страницы «От автора» с подставленным составом.

    Подстановки: {date} {edition} {written_count} {stub_count} {stub_titles}
    {composition}. Состав считается из конфига при каждой сборке — иначе
    он отстаёт от книги, как только добавится глава.
    """
    t = cfg.get("foreword") or ""
    if isinstance(t, list):
        t = "\n\n".join(t)
    title = cfg.text("foreword")
    m = re.match(r"\s*#\s+(.+)\n", t)
    if m:
        title, t = m.group(1).strip(), t[m.end():]
    stubs = [c for c in chapters if c.get("stub")]
    comp = "\n".join(
        f"{c['title']} — "
        + (f"{cfg.text('stub_short')} ({int(c['stub'].get('progress') or 0)}%)" if c.get("stub")
           else cfg.text("prose"))
        for c in chapters)
    subs = {"date": d, "edition": cfg.get("edition", ""),
            "written_count": str(len(chapters) - len(stubs)), "stub_count": str(len(stubs)),
            "stub_titles": ", ".join(c["title"] for c in stubs) or "—", "composition": comp}
    for k, v in subs.items():
        t = t.replace("{" + k + "}", v)
    return title, t.strip()


def scene_breaks(md: str) -> int:
    return sum(1 for b in blocks(md) if b == "---")


# ───────────────────────── структура книги ─────────────────────────

def plan(cfg: Config, until: str | None = None) -> list[tuple]:
    """Порядок вывода: [('chapter', ch) | ('part', part, [chapters])].

    Часть вставляется перед первой своей главой. Главы вне частей идут
    на верхнем уровне. Если задан until (фрагмент) — всё после этой
    главы отбрасывается, а оборванная часть сохраняет свой шмуцтитул.
    """
    chs = chapters_clean(cfg)
    if until:
        idx = [c["id"] for c in chs].index(until)
        chs = chs[: idx + 1]
    owner = {}
    for i, part in enumerate(cfg["parts"]):
        for cid in part.get("chapters", []):
            owner[cid] = i
    items, seen = [], set()
    for ch in chs:
        pi = owner.get(ch["id"])
        if pi is None:
            items.append(("chapter", ch))
        elif pi not in seen:
            seen.add(pi)
            members = [c for c in chs if owner.get(c["id"]) == pi]
            items.append(("part", cfg["parts"][pi], members))
    return items


def flat_chapters(items) -> list[dict]:
    out = []
    for it in items:
        out.extend([it[1]] if it[0] == "chapter" else it[2])
    return out


# ───────────────────────── текст для проверок ─────────────────────────

def norm(s: str) -> str:
    s = html.unescape(s).replace("\u00a0", " ").replace("\u00ad", "")
    s = s.replace("*", "")
    return re.sub(r"\s+", " ", s).strip()


def md_plain(md: str) -> str:
    md = re.sub(r"(?m)^#{2,6}\s+", "", md)
    md = re.sub(r"(?m)^>\s?", "", md)
    return norm(md)


INLINE_TAGS = r"</?(?:em|strong|emphasis|i|b|u|span|a|sup|sub|small|code)\b[^>]*>"


def strip_tags(s: str) -> str:
    """Строчные теги снимаются без пробела (иначе «final</strong>.» → «final .»),
    блочные — с пробелом (иначе склеиваются соседние абзацы)."""
    s = re.sub(INLINE_TAGS, "", s)
    return re.sub(r"<[^>]+>", " ", s)


def epub_files(path: Path) -> dict[str, str]:
    with zipfile.ZipFile(path) as z:
        return {n: z.read(n).decode("utf-8", "replace") for n in z.namelist()
                if n.endswith((".xhtml", ".html", ".opf", ".ncx", ".css"))}


def epub_text(path: Path, skip=("nav",)) -> str:
    parts = []
    for n, t in sorted(epub_files(path).items()):
        if n.endswith((".xhtml", ".html")) and not any(s in n for s in skip):
            parts.append(strip_tags(t))
    return norm(" ".join(parts))


def fb2_text(path: Path) -> str:
    t = path.read_text(encoding="utf-8")
    t = re.sub(r"<binary.*?</binary>", " ", t, flags=re.S)
    t = re.sub(r"<description>.*?</description>", " ", t, flags=re.S)
    return norm(strip_tags(t))


def probes(md_body: str, n: int = 5) -> list[str]:
    """Несколько фраз, равномерно взятых по главе: начало, середина, конец.
    Одной случайной фразы мало — так пропускается обрезанный хвост главы."""
    text = md_plain(md_body)
    sents = [s.strip() for s in re.split(r"(?<=[.!?…»])\s+", text)]
    sents = [s for s in sents if 30 <= len(s) <= 220 and "---" not in s]
    if not sents:
        return [text[:120]] if len(text) > 20 else []
    if len(sents) <= n:
        return sents
    step = (len(sents) - 1) / (n - 1)
    return [sents[round(i * step)] for i in range(n)]
