#!/usr/bin/env bash
# Окружение для сборки: ebooklib (ePub) и Calibre (MOBI, проверка MOBI).
# Безопасно запускать повторно: ставит только то, чего нет.
set -u

ok()   { echo "  ok    $*"; }
warn() { echo "  warn  $*"; }

# 1. ebooklib
if python3 -c "import ebooklib" 2>/dev/null; then ok "ebooklib"
else
  pip install ebooklib --break-system-packages -q 2>/dev/null || pip install ebooklib -q
  python3 -c "import ebooklib" 2>/dev/null && ok "ebooklib установлен" || warn "ebooklib не установился"
fi

# 2. Calibre (ebook-convert). Пакет calibre-bin без calibre не работает — ставим calibre целиком.
if command -v ebook-convert >/dev/null 2>&1 && ebook-convert --version >/dev/null 2>&1; then ok "Calibre: $(ebook-convert --version 2>/dev/null | sed -n 1p)"
else
  if command -v apt-get >/dev/null 2>&1; then
    (apt-get install -y --no-install-recommends calibre >/dev/null 2>&1) || \
    (apt-get update -qq >/dev/null 2>&1 && apt-get install -y --no-install-recommends calibre >/dev/null 2>&1)
  elif command -v brew >/dev/null 2>&1; then
    brew install --cask calibre >/dev/null 2>&1
  fi
  if command -v ebook-convert >/dev/null 2>&1; then ok "Calibre установлен"
  else warn "Calibre не установлен — MOBI собираться не будет (ePub и FB2 соберутся)"; fi
fi

# 3. Известный конфликт: lxml, поставленный через pip, ломает Calibre из apt
#    (ebook-convert падает на импорте lxml/html5-parser). Тогда pip-версию убираем,
#    а ebooklib продолжает работать на системном python3-lxml.
if command -v ebook-convert >/dev/null 2>&1 && ! ebook-convert --version >/dev/null 2>&1; then
  warn "ebook-convert не запускается — убираю pip-lxml"
  pip uninstall -y lxml --break-system-packages >/dev/null 2>&1 || pip uninstall -y lxml >/dev/null 2>&1
  ebook-convert --version >/dev/null 2>&1 && ok "Calibre работает" || warn "Calibre всё ещё не запускается"
fi
python3 -c "import ebooklib, lxml.etree" 2>/dev/null && ok "ebooklib + lxml импортируются" || warn "ebooklib/lxml не импортируются"
