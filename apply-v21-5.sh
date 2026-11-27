#!/bin/sh
# Injects header css + extras js into index.html (idempotent). Run from repo root.
F=site/index.html
[ -f "$F" ] || { echo "site/index.html not found"; exit 1; }
grep -q ceaser-header.css "$F" || sed -i 's#</head>#<link rel="stylesheet" href="assets/ceaser-header.css?v=21.5">\n</head>#' "$F"
grep -q ceaser-extras.js "$F" || sed -i 's#</body>#<script src="assets/ceaser-extras.js?v=21.5"></script>\n</body>#' "$F"
echo "index.html patched"
