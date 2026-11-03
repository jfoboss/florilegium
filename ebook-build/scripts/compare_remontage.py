#!/usr/bin/env python3
"""
Проверка целостности при перемонтаже: материал не потерялся и не задвоился,
когда автор переразрезал главы.

    python3 compare_remontage.py --old старые/*.md --new новые/*.md
    python3 compare_remontage.py --old-dir old --new-dir new --config book.json

Обычная сверка версий (глава с главой) здесь не работает: границы глав
сдвинулись, файлов стало другое число, имена сменились. Поэтому обе
стороны разбираются на абзацы и сравниваются как множества.

Отчёт отвечает на три вопроса:
  • что потерялось — абзац был, и дословно его больше нет;
  • что появилось — новый или переписанный материал;
  • нет ли дублей — один и тот же абзац попал в две главы сразу.

Дословно совпавшие абзацы считаются перенесёнными без изменений, даже
если переехали в другую главу. Потерянный абзац — не обязательно беда:
чаще это переписанное место, и у него есть пара среди появившихся.
Скрипт их не угадывает, а показывает рядом — решает автор.

Код возврата 1, если есть потери или дубли.
"""

from __future__ import annotations

import argparse
import glob
import re
import sys
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from ebook_common import load_config, clean_chapter          # noqa: E402
except Exception:                                                # pragma: no cover
    load_config = clean_chapter = None

MIN_WORDS = 6          # короче — служебные строки, их не считаем
NEAR = 0.75            # порог «похоже на переписанный абзац»


def norm_para(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def paragraphs(text: str) -> list[str]:
    """Абзацы главы без заголовка, шапок и отбивок."""
    text = re.sub(r"(?m)^#.*$", "", text)
    text = re.sub(r"\*\((?:версия|монтаж|version|draft)\b.*?\)\*", "", text, flags=re.S | re.I)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    out = []
    for b in re.split(r"\n\s*\n", text):
        b = norm_para(b)
        if b in ("---", "***", "* * *") or b.startswith("*(") or not b:
            continue
        if len(re.findall(r"[^\W\d_]+", b, re.U)) < MIN_WORDS:
            continue
        out.append(b)
    return out


def collect(paths: list[Path]) -> list[tuple[str, str]]:
    """[(имя файла, абзац)] по всем файлам в порядке чтения."""
    res = []
    for p in sorted(paths):
        for para in paragraphs(p.read_text(encoding="utf-8")):
            res.append((p.name, para))
    return res


def words(items) -> int:
    return sum(len(re.findall(r"[^\W\d_]+", t, re.U)) for _, t in items)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", nargs="*", default=[])
    ap.add_argument("--new", nargs="*", default=[])
    ap.add_argument("--old-dir")
    ap.add_argument("--new-dir")
    ap.add_argument("--glob", default="*.md")
    ap.add_argument("--near", type=float, default=NEAR,
                    help="порог похожести для подсказки пары (0–1)")
    a = ap.parse_args()

    old_paths = [Path(x) for pat in a.old for x in glob.glob(pat)]
    new_paths = [Path(x) for pat in a.new for x in glob.glob(pat)]
    if a.old_dir:
        old_paths += [Path(x) for x in glob.glob(str(Path(a.old_dir) / a.glob))]
    if a.new_dir:
        new_paths += [Path(x) for x in glob.glob(str(Path(a.new_dir) / a.glob))]
    if not old_paths or not new_paths:
        raise SystemExit("Нужны обе стороны: --old/--new или --old-dir/--new-dir")

    old = collect(old_paths)
    new = collect(new_paths)
    old_set = {t for _, t in old}
    new_set = {t for _, t in new}

    lost = [(f, t) for f, t in old if t not in new_set]
    added = [(f, t) for f, t in new if t not in old_set]
    dups = [t for t, n in Counter(t for _, t in new).items() if n > 1]

    print(f"Старое: {len(old_paths)} файлов, {len(old)} абзацев, {words(old)} слов")
    print(f"Новое:  {len(new_paths)} файлов, {len(new)} абзацев, {words(new)} слов")
    print(f"Дельта: {words(new) - words(old):+} слов\n")

    print(f"── перенесено дословно: {len(old) - len(lost)} абзацев")

    print(f"\n── ПОТЕРЯНО дословно: {len(lost)}")
    for f, t in lost:
        print(f"   • [{f}] {t[:120]}")
        best, score = None, 0.0
        for f2, t2 in added:
            s = SequenceMatcher(None, t, t2).ratio()
            if s > score:
                best, score = (f2, t2), s
        if best and score >= a.near:
            print(f"     ↳ похоже на переписанное ({score:.0%}): [{best[0]}] {best[1][:110]}")

    print(f"\n── НОВОЕ ИЛИ ПЕРЕПИСАННОЕ: {len(added)}")
    for f, t in added:
        print(f"   • [{f}] {t[:120]}")

    print(f"\n── ДУБЛИ В НОВОМ: {len(dups)}")
    for t in dups:
        where = [f for f, x in new if x == t]
        print(f"   • {t[:110]}")
        print(f"     в: {', '.join(where)}")

    hard = [x for x in lost if not any(
        SequenceMatcher(None, x[1], t2).ratio() >= a.near for _, t2 in added)]
    print(f"\nИтог: потеряно без пары {len(hard)}, дублей {len(dups)}")
    if hard or dups:
        print("Разбери каждый пункт с автором, прежде чем собирать книгу.")
    sys.exit(1 if (hard or dups) else 0)


if __name__ == "__main__":
    main()
