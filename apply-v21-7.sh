#!/bin/sh
# Run from repo root. Safe to run many times.
F=site/index.html
[ -f "$F" ] || { echo "site/index.html not found"; exit 1; }
grep -q ceaser-header.css "$F" || sed -i 's#</head>#<link rel="stylesheet" href="assets/ceaser-header.css?v=21.5">\n</head>#' "$F"
grep -q ceaser-extras.js "$F" || sed -i 's#</body>#<script src="assets/ceaser-extras.js?v=21.7"></script>\n</body>#' "$F"
grep -q adsbygoogle "$F" || sed -i 's#</head>#<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1456980829304780" crossorigin="anonymous"></script>\n</head>#' "$F"
S=src/server.js
[ -f "$S" ] || { echo "src/server.js not found"; exit 1; }
grep -q "require('./guard')" "$S" || sed -i "s#^app.use(cookieParser());#app.use(cookieParser());\nrequire('./guard')(app); // anti-clone guard#" "$S"
grep -q "require('./guard')" "$S" && echo "guard active in server.js" || echo "WARNING: could not add guard to server.js"
echo done
