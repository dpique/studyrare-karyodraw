#!/usr/bin/env bash
# Launch KaryoScope.
#
# The app must be *served* over HTTP — browsers refuse to load the <script src>
# data/module files over a file:// URL. This starts a tiny local web server
# (only if one isn't already running) and opens the app. Safe to run repeatedly.
#
# Stop the server later with:  lsof -ti tcp:8770 | xargs kill
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${KARYOSCOPE_PORT:-8770}"
URL="http://localhost:${PORT}/index.html"

if ! lsof -ti "tcp:${PORT}" >/dev/null 2>&1; then
  nohup python3 -m http.server "${PORT}" --directory "${DIR}" >/dev/null 2>&1 &
  disown 2>/dev/null || true
  for _ in $(seq 1 10); do
    lsof -ti "tcp:${PORT}" >/dev/null 2>&1 && break
    sleep 0.3
  done
fi

open "${URL}"
echo "KaryoScope → ${URL}"
echo "(server on port ${PORT}; stop it with:  lsof -ti tcp:${PORT} | xargs kill)"
