#!/usr/bin/env python3
"""
Полный переносимый комплект проекта: книги, исходники, обложка, материалы,
инструменты сборки, README и манифест md5.

    python3 package_project.py --config book.json --out /path/Name_полный_комплект.zip [--date YYYY-MM-DD]

Что делает:
  1. раскладывает всё по папкам комплекта (книги / главы / инструменты / материалы);
  2. пишет внутрь book.json с путями ОТНОСИТЕЛЬНО комплекта;
  3. пересобирает книги прямо из комплекта (с той же датой) и прогоняет проверку —
     так доказывается, что комплект самодостаточен;
  4. сверяет текст пересобранных книг с исходными сборками (без учёта байтов zip);
  5. пишет README и MANIFEST.txt, пакует zip, распаковывает и сверяет md5.
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from ebook_common import load_config, epub_text, fb2_text, chapter_garden, CHAPTER_GARDEN_DEFAULTS  # noqa: E402

DIRS = {
    "ru": {"books": "книги", "chapters": "главы", "tools": "инструменты", "materials": "материалы"},
    "en": {"books": "books", "chapters": "chapters", "tools": "tools", "materials": "materials"},
}
TOOLS = ["ebook_common.py", "build_book.py", "verify_book.py", "package_project.py",
         "compare_remontage.py", "setup_env.sh", "make_gardens.py", "florilegium-garden.js", "garden_render.js"]


def md5(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()


def detect_date(cfg) -> str | None:
    p = cfg.path(cfg["output_dir"]) / (cfg["basename"] + ".epub")
    if not p.exists():
        return None
    m = re.search(re.escape(cfg.text("built")) + r"\s+(\d{4}-\d{2}-\d{2})", epub_text(p))
    return m.group(1) if m else None


def readme(cfg, d: dict, name: str, built_date: str, root: Path, kit: dict) -> str:
    """README по тому, что действительно лежит в комплекте: только существующие
    папки, все собранные книги (и садовые версии), раздел о садах, если они есть."""
    books = root / d["books"]
    stems: dict[str, list[str]] = {}
    for p in sorted(books.iterdir()) if books.exists() else []:
        stems.setdefault(p.stem, []).append(p.suffix.lstrip(".").upper())
    modes = kit.get("modes") or {}
    sfx = kit.get("gardens_suffix", "_сад")
    frags = {f["basename"]: f["until"] for f in kit.get("fragments", []) if f.get("basename")}

    def label(stem: str) -> str:
        base = stem[:-len(sfx)] if sfx and stem.endswith(sfx) else stem
        g = " с садами" if base != stem else ""
        if base in frags:
            return f"фрагмент до главы `{frags[base]}`{g}"
        return f"полная книга{g}" if base == kit["basename"] else (f"книга{g}")
    book_lines = "".join(f"  - `{s}` ({', '.join(f)}) — {label(s)};\n" for s, f in stems.items())

    def nonempty(sub: str) -> bool:
        q = root / sub
        return q.is_dir() and any(q.rglob("*"))
    dirs = []
    if nonempty(d["books"]):
        dirs.append(f"- `{d['books']}/` — готовые книги:\n{book_lines}")
    dirs.append(f"- `{d['chapters']}/` — исходный текст. Единственный источник книги: все форматы собираются из него.\n")
    if nonempty(d["materials"]):
        dirs.append(f"- `{d['materials']}/` — аннотация, «От автора» и прочие материалы проекта.\n")
    tools_note = "скрипты сборки и проверки, обложка"
    if nonempty(f"{d['tools']}/gardens"):
        tools_note += "; `gardens/` — готовые картинки садов"
        if nonempty(f"{d['tools']}/gardens/chapters"):
            tools_note += " (шмуцтитулы частей, а в `gardens/chapters/` — заставки, буквицы и концовки глав)"
    dirs.append(f"- `{d['tools']}/` — {tools_note}.\n")
    dirs.append("- `book.json` — описание книги: название, автор, порядок глав, части, аннотация, обложка, фрагменты"
                + (", режимы" if modes else "") + ".\n")
    dirs.append("- `MANIFEST.txt` — контрольные суммы md5 всех файлов.\n")

    gardens_on = bool(kit.get("gardens") or kit.get("chapter_gardens")
                      or any(isinstance(m, dict) and (m.get("gardens") or m.get("chapter_gardens")) for m in modes.values()))
    garden_parts = any((p or {}).get("garden") for p in kit.get("parts", []))
    live_on = bool(kit.get("gardens_live") or any(isinstance(m, dict) and m.get("gardens_live") for m in modes.values()))
    garden_modes = [k for k, m in modes.items() if isinstance(m, dict) and m.get("gardens")]
    gsec = ""
    if gardens_on or garden_parts:
        how = (f"режим «{garden_modes[0]}» (`--all-modes` собирает обе версии)" if garden_modes
               else "флаг `--gardens`")
        gsec = f"""
## Сады

Нарядная версия книги — с садами florilegium{' на шмуцтитулах частей' if garden_parts else ''}{' и в главах (заставка, буквица, концовка)' if (kit.get('chapter_gardens') or any(isinstance(m, dict) and m.get('chapter_gardens') for m in modes.values())) else ''}.
Собирается как {how}; файлы получают суффикс `{sfx}`, спокойная версия от этого не меняется.
{'Сады живые (включено в book.json): в ePub лежит движок (`js/florilegium-garden.js`), и сад перерастает под экран читалки; без скриптов остаются картинки.' if live_on else 'Живые сады (перерастают под экран читалки) — флаг `--live`.'}
Картинки садов уже лежат в `{d['tools']}/gardens/`, сборке больше ничего не нужно.
Перерисовать их (новый seed, другие цвета): `python3 {d['tools']}/make_gardens.py --config book.json` —
для садов в главах нужен `node`, для шмуцтитулов — ещё `texlua` и клон github.com/kevinraymond/florilegium (`--florilegium путь`).
"""
    build = f"python3 {d['tools']}/build_book.py --config book.json"
    builds = build + ("   # режим по умолчанию\n" + build + " --all-modes   # все режимы и проверка, что проза в них совпадает"
                      if modes else "")
    return f"""# {cfg['title']}{(' — ' + cfg['subtitle']) if cfg.get('subtitle') else ''}

{cfg.get('edition', '')}. Комплект собран {built_date}.

## Что внутри

{''.join(dirs)}
## Как пересобрать

Нужен Python 3.10+ и `pip install ebooklib`; для MOBI — Calibre (`ebook-convert`).
Установить всё разом: `bash {d['tools']}/setup_env.sh`.

```
{builds}
```

Сборка сама запускает проверку и завершается с ошибкой, если что-то не так.
Проверить уже готовые книги отдельно:

```
python3 {d['tools']}/verify_book.py --config book.json{' --all-modes' if modes else ''}
```

Проверка смотрит: все главы на месте (по пять фраз из каждой), во фрагменте нет текста
из глав за границей, оглавление полное и по порядку, отбивки сцен на месте, нет служебных
пометок и сырой разметки, обложка и аннотация есть, FB2 — валидный XML, MOBI читается{', сады на месте' if (gardens_on or garden_parts) else ''}.
{gsec}
Пути в `book.json` считаются от папки комплекта, так что его можно переносить куда угодно.
Дату на титуле можно зафиксировать: `--date {built_date}` — тогда пересборка даст тот же текст.
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--date")
    ap.add_argument("--gardens", action="store_true", help="комплект собирается и проверяется в режиме с садом")
    ap.add_argument("--live", action="store_true", help="… и с живым садом (скрипт на шмуцтитулах)")
    a = ap.parse_args()
    if a.live:
        a.gardens = True
    cfg = load_config(a.config, gardens=a.gardens, live=a.live)
    built_date = a.date or detect_date(cfg) or date.today().isoformat()
    pk = cfg.get("package", {})
    name = pk.get("name") or cfg["basename"]
    d = {**DIRS.get(cfg["language"][:2], DIRS["en"]), **pk.get("dirs", {})}

    tmp = Path(tempfile.mkdtemp())
    root = tmp / name
    for k in d.values():
        (root / k).mkdir(parents=True, exist_ok=True)

    new = {k: v for k, v in cfg.items() if not k.startswith("_")}
    # главы
    if cfg.get("source_file"):
        src = cfg.path(cfg["source_file"])
        shutil.copy2(src, root / d["chapters"] / src.name)
        new["source_file"] = f"{d['chapters']}/{src.name}"
    else:
        for ch in cfg["_chapters"]:
            if ch.get("stub"):
                continue          # плашка-пропуск: файла нет, запись остаётся в book.json
            shutil.copy2(ch["path"], root / d["chapters"] / ch["path"].name)
        new["chapters_dir"] = d["chapters"]
        new["chapters"] = [ch["stub"] if ch.get("stub") else ch["path"].name for ch in cfg["_chapters"]]
        new.pop("chapters_glob", None)
    # обложка
    if cfg.get("cover"):
        c = cfg.path(cfg["cover"])
        shutil.copy2(c, root / d["tools"] / c.name)
        new["cover"] = f"{d['tools']}/{c.name}"
    # сады на шмуцтитулах частей: едут в комплект, если картинки есть,
    # чтобы из комплекта собирался и режим с садом
    for part in new.get("parts", []):
        g = part.get("garden")
        if g:
            src = cfg.path(g["image"])
            if not src or not src.exists():
                print(f"  WARN: сада {g.get('image')} нет — в комплект не попал; "
                      f"режим с садом из комплекта не соберётся без make_gardens.py")
                continue
            (root / d["tools"] / "gardens").mkdir(exist_ok=True)
            shutil.copy2(src, root / d["tools"] / "gardens" / src.name)
            part["garden"] = {**g, "image": f"{d['tools']}/gardens/{src.name}"}
    # аннотация
    if cfg.get("annotation_file"):
        af = cfg.path(cfg["annotation_file"])
        shutil.copy2(af, root / d["materials"] / af.name)
        new["annotation_file"] = f"{d['materials']}/{af.name}"
    orig = json.loads(cfg["_file"].read_text(encoding="utf-8"))
    # Режим с садом — выбор сборки, а не свойство книги: в book.json
    # комплекта остаются исходные имя файла и выключатель (без суффикса).
    new["basename"] = orig["basename"]
    for k in ("gardens", "gardens_suffix", "gardens_live"):
        if k in orig:
            new[k] = orig[k]
        else:
            new.pop(k, None)
    for fr_new, fr_orig in zip(new.get("fragments", []), orig.get("fragments", [])):
        if "basename" in fr_orig:
            fr_new["basename"] = fr_orig["basename"]
    # аннотация из файла не дублируется в book.json комплекта
    if "annotation" not in orig:
        new.pop("annotation", None)
    # «От автора» из файла — так же
    if cfg.get("foreword_file"):
        ff = cfg.path(cfg["foreword_file"])
        shutil.copy2(ff, root / d["materials"] / ff.name)
        new["foreword_file"] = f"{d['materials']}/{ff.name}"
        if "foreword" not in orig:
            new.pop("foreword", None)
    # Режимы: load_config уже слил текущий режим в верхний уровень и убрал
    # modes. Без возврата комплект собирал бы только один режим.
    for k in ("modes", "default_mode"):
        if k in orig:
            new[k] = json.loads(json.dumps(orig[k]))
    # Файлы, на которые ссылается только один из режимов, тоже едут в
    # комплект — иначе второй режим из комплекта не соберётся.
    where = {"cover": d["tools"], "annotation_file": d["materials"], "foreword_file": d["materials"]}
    for m, over in (new.get("modes") or {}).items():
        for key, sub in where.items():
            if over.get(key):
                src = cfg.path(over[key])
                shutil.copy2(src, root / sub / src.name)
                over[key] = f"{sub}/{src.name}"
    # сады в главах (заставки, буквицы, концовки): папка картинок едет в комплект
    # (после возврата режимов: load_config убирает modes, и сады, включённые
    # только в садовом режиме, иначе искались бы в несуществующем new["modes"])
    orig_cfg = orig
    cg_where = [new] if orig_cfg.get("chapter_gardens") else []
    cg_where += [new["modes"][m] for m, mv in (orig_cfg.get("modes") or {}).items()
                 if isinstance(mv, dict) and mv.get("chapter_gardens")]
    if cg_where:
        cg_src = orig_cfg.get("chapter_gardens") or next(
            mv["chapter_gardens"] for mv in (orig_cfg.get("modes") or {}).values()
            if isinstance(mv, dict) and mv.get("chapter_gardens"))
        probe = dict(cfg)
        probe["chapter_gardens"] = {**CHAPTER_GARDEN_DEFAULTS, **(cg_src if isinstance(cg_src, dict) else {})}
        dst = root / d["tools"] / "gardens" / "chapters"
        copied = missing = 0
        for ch in cfg["_chapters"]:
            g = chapter_garden(probe, ch, force=True)
            for key in ("head", "tail", "initial"):
                if g and g[key]:
                    src = cfg.path(g[key])
                    if src.exists():
                        dst.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src, dst / src.name)
                        copied += 1
                    else:
                        missing += 1
        if missing:
            print(f"  WARN: картинок садов в главах нет: {missing} — режим с садом из комплекта не соберётся без make_gardens.py")
        for where in cg_where:
            cgv = where.get("chapter_gardens")
            cgv = dict(cgv) if isinstance(cgv, dict) else {}
            cgv["dir"] = f"{d['tools']}/gardens/chapters"
            if cgv.get("seeds"):          # главы в комплекте лежат плоско: ключи — имена файлов
                cgv["seeds"] = {Path(k).name: v for k, v in cgv["seeds"].items()}
            where["chapter_gardens"] = cgv
    elif "chapter_gardens" in new:
        new.pop("chapter_gardens")
    # материалы
    copied_extra = 0
    for sub, patterns in (pk.get("include") or {}).items():
        dst = root / sub
        dst.mkdir(parents=True, exist_ok=True)
        for pat in patterns:
            for f in glob.glob(str(cfg.path(pat))):
                if Path(f).is_file():
                    shutil.copy2(f, dst / Path(f).name)
                    copied_extra += 1
    new["output_dir"] = d["books"]
    new["package"] = {**pk, "dirs": d, "include": {}}
    for k in ("texts",):
        new[k] = cfg[k]
    (root / "book.json").write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
    # инструменты
    for t in TOOLS:
        if (HERE / t).exists():
            shutil.copy2(HERE / t, root / d["tools"] / t)

    # пересборка из комплекта
    print(f"Пересобираю из комплекта (дата {built_date})…")
    cmd = [sys.executable, str(root / d["tools"] / "build_book.py"),
           "--config", str(root / "book.json"), "--date", built_date]
    if new.get("modes"):
        cmd.append("--all-modes")      # иначе из комплекта проверяется только один режим
    if a.gardens:
        cmd.append("--gardens")
    if a.live:
        cmd.append("--live")
    r = subprocess.run(cmd, capture_output=True, text=True, cwd="/")
    print("\n".join(l for l in r.stdout.splitlines() if l.startswith(("Собрано", "Итого", " FAIL"))))
    if r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-2000:])
        raise SystemExit("СТОП: книги из комплекта не собрались или не прошли проверку")
    for p in (root / d["books"]).glob("*"):
        if p.suffix == ".zip":
            p.unlink()

    # сверка текста с исходной сборкой
    orig_dir = cfg.path(cfg["output_dir"])
    for p in sorted((root / d["books"]).iterdir()):
        o = orig_dir / p.name
        if not o.exists() or p.suffix not in (".epub", ".fb2"):
            continue
        same = (epub_text(p) == epub_text(o)) if p.suffix == ".epub" else (fb2_text(p) == fb2_text(o))
        print(f"  текст {p.name}: {'совпадает с исходной сборкой' if same else 'ОТЛИЧАЕТСЯ от исходной сборки'}")

    (root / "README.md").write_text(readme(cfg, d, name, built_date, root, new), encoding="utf-8")
    rows = []
    for dp, dn, fn in os.walk(root):
        dn[:] = sorted(x for x in dn if x != "__pycache__")
        for f in sorted(fn):
            p = Path(dp) / f
            rel = p.relative_to(root).as_posix()
            if rel != "MANIFEST.txt":
                rows.append(f"{md5(p)}  {p.stat().st_size:>9d}  {rel}")
    (root / "MANIFEST.txt").write_text(
        f"{cfg['title']} — полный комплект. Собрано {built_date}.\n\n" + "\n".join(sorted(rows, key=lambda x: x[44:])) + "\n",
        encoding="utf-8")

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for dp, dn, fn in os.walk(root):
            dn[:] = [x for x in dn if x != "__pycache__"]
            for f in fn:
                p = Path(dp) / f
                z.write(p, p.relative_to(tmp).as_posix())
    # распаковка и сверка
    chk = Path(tempfile.mkdtemp())
    with zipfile.ZipFile(out) as z:
        z.extractall(chk)
    bad = 0
    for line in (chk / name / "MANIFEST.txt").read_text(encoding="utf-8").splitlines():
        m = re.match(r"([0-9a-f]{32})\s+\d+\s+(.+)$", line)
        if m and md5(chk / name / m.group(2)) != m.group(1):
            bad += 1
            print("  РАСХОЖДЕНИЕ:", m.group(2))
    print(f"Комплект: {out}  {out.stat().st_size / 1024 / 1024:.1f} МБ, файлов {len(rows) + 1}, "
          f"материалов {copied_extra}; распакован и сверен с манифестом — расхождений {bad}")
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.rmtree(chk, ignore_errors=True)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
