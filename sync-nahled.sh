#!/bin/sh
# Přenese aktuální stav site/ (a server.py) do složky mimo iCloud Drive,
# ze které umí číst vestavěný náhled — macOS mu do iCloudu nedovolí sáhnout.
#
# Spusť po každé úpravě a v panelu náhledu dej reload.
# Pro běžnou práci v prohlížeči stačí ./nahled.sh, ten je vždy živý.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="/private/tmp/claude-501/-Users-jaktom-Library-Mobile-Documents-com-apple-CloudDocs-GitHub-Katka--alamonov-/c6911383-e80c-4f8f-9e49-6f429269c954/scratchpad"

mkdir -p "$BASE/preview"
rm -rf "$BASE/preview"/*
cp -R "$ROOT/site"/. "$BASE/preview"/
cp "$ROOT/server.py" "$BASE/server.py"
echo "Náhled aktualizován: $BASE/preview"
echo "V panelu náhledu dej reload (http://localhost:8794/)"
