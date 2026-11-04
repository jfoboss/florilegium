#!/usr/bin/env python3
"""
Сады для шмуцтитулов частей — по book.json.

    python3 make_gardens.py --config book.json --florilegium path/to/florilegium [--force]

У каждой части с полем {"garden": {"image": "gardens/act1.png", "seed": 1}}
выращивает сад генератором florilegium (github.com/kevinraymond/florilegium,
файл florilegium-svg.lua, MIT) и кладёт прозрачный PNG по пути image. Сборка в режиме
с садом (build_book.py --gardens или "gardens": true в режиме) берёт готовые
картинки и генератор не запускает. Спокойная сборка садов не касается.

Шаги на каждый сад:
  1. florilegium-svg.lua рисует страницу 120×200 мм: сад на левом поле и под «концом
     текста», пустой угол справа сверху — под название части;
  2. с опцией --bleed (florilegium #27) генератор не обрезает цветы по краю
     листа: на шмуцтитуле сад стоит посреди страницы читалки, и срез был бы
     виден. Стороны маски, обращённые к тексту (граница зоны под название),
     остаются;
  3. растр 10 px/мм с запасом 40 pt вокруг, обрезка общего пустого поля до
     холста 121×201 мм — на него рассчитаны координаты названия
     (GARDEN_LAYOUT в ebook_common.py);
  4. 256 цветов с прозрачностью: ~200 КБ вместо ~900 КБ. Вектор не берём:
     ~2 МБ на страницу и сотни наложений multiply, которые читалки рисуют
     по-разному.

Параметры генератора — в "garden_generator" (book.json): ink, accent, theme,
season, novisitors. Геометрию листа менять нельзя без пересчёта
garden_layout: название встанет мимо пустого угла.

В PNG записываются seed и параметры; совпадают — сад не перерисовывается.
Нужны: texlua (или lua5.4), rsvg-convert, Pillow.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ebook_common import load_config, GARDEN_GEN_DEFAULTS, CHAPTER_GARDEN_DEFAULTS, chapter_garden  # noqa: E402

# Геометрия листа: под неё рассчитаны GARDEN_LAYOUT и обрезка CROP_PX.
PAGE = ["--paper", "120x200", "--left", "36mm", "--right", "12mm", "--top", "36mm",
        "--bottom", "12mm", "--headsep", "0mm", "--headheight", "0pt", "--textend", "50mm", "--nohead"]
PAD_PT = 40                          # запас вокруг листа, pt
PX_PER_MM = 10
CROP_PX = (100, 160, 1310, 2170)     # -> 1210×2010 px = холст 121×201 мм
DEFAULTS = GARDEN_GEN_DEFAULTS     # общие с живым садом (ebook_common.garden_gen)


def lua_cmd() -> list[str]:
    for exe in ("texlua", "lua5.4", "lua5.3", "lua"):
        if shutil.which(exe):
            return [exe]
    raise SystemExit("make_gardens: нужен texlua или lua 5.3/5.4")


def grow(svg_lua: Path, seed: int, gen: dict, out: Path) -> None:
    from PIL import Image, PngImagePlugin
    if not shutil.which("rsvg-convert"):
        raise SystemExit("make_gardens: нужен rsvg-convert (пакет librsvg2-bin)")
    # --bleed (florilegium #27): the garden is not cut along the sheet's edges, and the SVG
    # grows by PAD_PT on every side; the live garden (shmuc.js) asks for the same bleed
    args = PAGE + ["--seed", str(seed), "--ink", gen["ink"], "--accent", gen["accent"],
                   "--theme", gen["theme"], "--season", str(gen["season"]), "--bleed", f"{PAD_PT}bp"]
    if gen.get("novisitors"):
        args.append("--novisitors")
    with tempfile.TemporaryDirectory() as td:
        wide, png = Path(td, "wide.svg"), Path(td, "wide.png")
        # запуск из временной папки: florilegium-svg.lua подгружает соседние .lua по своему пути
        subprocess.run(lua_cmd() + [str(svg_lua.resolve())] + args + ["-o", str(wide)], check=True, cwd=td)
        w_mm = float(re.search(r'width="([\d.]+)mm"', wide.read_text(encoding="utf-8")).group(1))
        subprocess.run(["rsvg-convert", "-w", str(round(w_mm * PX_PER_MM)), str(wide), "-o", str(png)], check=True)
        im = Image.open(png).convert("RGBA")
        a = im.getchannel("A")
        w, h = im.size
        if max(a.crop(b).getextrema()[1] for b in ((0, 0, 2, h), (w - 2, 0, w, h), (0, 0, w, 2), (0, h - 2, w, h))):
            print(f"  WARN seed {seed}: рисунок касается края холста — увеличьте PAD_PT")
        im = im.crop(CROP_PX)
        bb = im.getchannel("A").getbbox()
        if bb and (bb[0] == 0 or bb[1] == 0 or bb[2] == im.size[0] or bb[3] == im.size[1]):
            print(f"  WARN seed {seed}: сад обрезан краем холста {bb} — проверьте CROP_PX")
        q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        info = PngImagePlugin.PngInfo()
        info.add_text("florilegium", stamp(seed, gen))
        out.parent.mkdir(parents=True, exist_ok=True)
        q.save(out, optimize=True, pnginfo=info)


def stamp(seed: int, gen: dict) -> str:
    return json.dumps({"seed": seed, **gen, "page": PAGE, "crop": CROP_PX, "bleed": PAD_PT}, sort_keys=True)


# ───────── сады в главах: движок на JS (node), без Lua ─────────
# Заставка — полоса 128×80 мм (на экране телефона это около трети страницы),
# виньетка — 70×26 мм, плитка буквицы — 20×20 мм. Растр с запасом вокруг листа
# и обрезкой по рисунку: сад у края полосы не режется прямой линией.
CH_KINDS = {
    "head": {"kind": "band", "width": 128, "height": 80, "pad_pt": 40, "px_per_mm": 8, "crop": True},
    "tail": {"kind": "vignette", "pad_pt": 12, "px_per_mm": 10, "crop": True},
    "initial": {"kind": "tile", "pad_pt": 0, "px_per_mm": 18, "crop": False},
}
RENDER_JS = Path(__file__).resolve().parent / "garden_render.js"
ENGINE_JS = Path(__file__).resolve().parent / "florilegium-garden.js"


def engine_version() -> str:
    import hashlib
    return hashlib.md5(ENGINE_JS.read_bytes()).hexdigest()[:12]


def ch_stamp(key: str, seed: int, gen: dict) -> str:
    return json.dumps({"chapter": key, "seed": seed, **gen, "spec": CH_KINDS[key], "engine": engine_version()}, sort_keys=True)


def pad_svg(svg: str, pad: float) -> tuple[str, float]:
    """Запас вокруг листа (в pt): viewBox и размер в мм растут на pad с каждой стороны."""
    m = re.search(r'width="([\d.]+)mm" height="([\d.]+)mm" viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    W, H = float(m.group(3)), float(m.group(4))
    wmm = (W + 2 * pad) / 72 * 25.4
    svg = svg.replace(m.group(0), f'width="{wmm:.2f}mm" height="{(H + 2 * pad) / 72 * 25.4:.2f}mm" '
                                  f'viewBox="{-pad} {-pad} {W + 2 * pad:.2f} {H + 2 * pad:.2f}"', 1)
    return svg, wmm


def grow_chapters(jobs: list[dict], gen: dict) -> None:
    from PIL import Image, PngImagePlugin
    node = shutil.which("node")
    if not node:
        raise SystemExit("make_gardens: садам в главах нужен node (движок florilegium на JS)")
    if not shutil.which("rsvg-convert"):
        raise SystemExit("make_gardens: нужен rsvg-convert (пакет librsvg2-bin)")
    with tempfile.TemporaryDirectory() as td:
        spec = []
        for i, j in enumerate(jobs):
            k = CH_KINDS[j["key"]]
            spec.append({"kind": k["kind"], "seed": j["seed"], "ink": gen["ink"], "accent": gen["accent"],
                         "season": str(gen["season"]), "novisitors": bool(gen.get("novisitors")),
                         "width": k.get("width"), "height": k.get("height"), "out": str(Path(td, f"{i}.svg"))})
        Path(td, "jobs.json").write_text(json.dumps(spec), encoding="utf-8")
        subprocess.run([node, str(RENDER_JS), str(Path(td, "jobs.json"))], check=True, cwd=td, stdout=subprocess.DEVNULL)
        for i, j in enumerate(jobs):
            k = CH_KINDS[j["key"]]
            svg, wmm = pad_svg(Path(td, f"{i}.svg").read_text(encoding="utf-8"), k["pad_pt"])
            Path(td, f"{i}p.svg").write_text(svg, encoding="utf-8")
            png = Path(td, f"{i}.png")
            subprocess.run(["rsvg-convert", "-w", str(round(wmm * k["px_per_mm"])), str(Path(td, f"{i}p.svg")), "-o", str(png)],
                           check=True)
            im = Image.open(png).convert("RGBA")
            if k["crop"]:
                bb = im.getchannel("A").getbbox()
                if bb:
                    if bb[0] == 0 or bb[1] == 0 or bb[2] == im.width or bb[3] == im.height:
                        print(f"  WARN {j['out'].name}: рисунок касается края холста — увеличьте pad_pt")
                    im = im.crop((max(0, bb[0] - 2), max(0, bb[1] - 2), min(im.width, bb[2] + 2), min(im.height, bb[3] + 2)))
            q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
            info = PngImagePlugin.PngInfo()
            info.add_text("florilegium", j["stamp"])
            j["out"].parent.mkdir(parents=True, exist_ok=True)
            q.save(j["out"], optimize=True, pnginfo=info)


def chapter_jobs(cfg_path: Path, raw: dict, gen: dict, force: bool) -> tuple[list[dict], int]:
    """Что перерисовать в главах. chapter_gardens берётся из book.json или из режима."""
    cg = raw.get("chapter_gardens") or next((m.get("chapter_gardens") for m in (raw.get("modes") or {}).values()
                                             if isinstance(m, dict) and m.get("chapter_gardens")), None)
    if not cg:
        return [], 0
    from PIL import Image
    cfg = load_config(str(cfg_path))
    cfg["chapter_gardens"] = {**CHAPTER_GARDEN_DEFAULTS, **(cg if isinstance(cg, dict) else {})}
    jobs, skipped = [], 0
    for ch in cfg["_chapters"]:
        d = chapter_garden(cfg, ch, force=True)
        if not d:
            continue
        for key in ("head", "tail", "initial"):
            if not d[key]:
                continue
            out = cfg_path.parent / d[key]
            want = ch_stamp(key, d["seed"], gen)
            if out.exists() and not force and Image.open(out).info.get("florilegium") == want:
                skipped += 1
                continue
            jobs.append({"key": key, "seed": d["seed"], "out": out, "stamp": want})
    return jobs, skipped


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--florilegium", help="папка florilegium с florilegium-svg.lua (по умолчанию — корень этого репозитория)")
    ap.add_argument("--force", action="store_true", help="перерисовать даже совпадающие")
    a = ap.parse_args()

    # load_config в режиме с садом требует, чтобы картинки уже были — читаем конфиг напрямую
    cfg_path = Path(a.config).resolve()
    raw = json.loads(cfg_path.read_text(encoding="utf-8"))
    gen = {**DEFAULTS, **(raw.get("garden_generator") or {})}
    made = skipped = 0
    # по умолчанию — сам репозиторий: скилл лежит в ebook-build/ форка florilegium
    root = Path(a.florilegium) if a.florilegium else Path(__file__).resolve().parents[2]
    # с версии 1.3 модули florilegium носят приставку: florilegium-svg.lua (раньше svg.lua)
    svg_lua = next((p for p in (root / "florilegium-svg.lua", root / "svg.lua") if p.exists()), None)
    for part in raw.get("parts", []):
        g = part.get("garden")
        if not isinstance(g, dict) or "seed" not in g:
            continue
        out = cfg_path.parent / g["image"]
        want = stamp(int(g["seed"]), gen)
        if out.exists() and not a.force:
            from PIL import Image
            if Image.open(out).info.get("florilegium") == want:
                skipped += 1
                continue
        if not svg_lua or not svg_lua.exists():
            raise SystemExit(f"make_gardens: сад части «{part.get('label') or part.get('name')}» нужно вырастить — "
                             "укажите --florilegium (папка с florilegium-svg.lua)")
        print(f"сад: {part.get('label') or part.get('name')} — seed {g['seed']} -> {g['image']}")
        grow(svg_lua, int(g["seed"]), gen, out)
        made += 1
    jobs, sk = chapter_jobs(cfg_path, raw, gen, a.force)
    if jobs:
        print(f"сады в главах: рисую {len(jobs)} картинок (заставки, концовки, буквицы)…")
        grow_chapters(jobs, gen)
    made += len(jobs)
    skipped += sk
    print(f"Готово: выращено {made}, без изменений {skipped}")
    load_config(str(cfg_path), gardens=True)   # режим с садом теперь загружается: все сады на месте


if __name__ == "__main__":
    main()
