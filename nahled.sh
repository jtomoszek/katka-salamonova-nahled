#!/bin/sh
# Lokální náhled webu v prohlížeči.
#
# Projekt leží v iCloud Drive, kde macOS procesu vestavěného náhledu
# (Browser panel) zakazuje čtení. Terminál omezený není, takže odsud
# se dá složka site/ servírovat napřímo a živě.
#
#   ./nahled.sh          http://localhost:8794/
#   ./nahled.sh 9000     jiný port
#
# Pro vestavěný náhled v aplikaci použij ./sync-nahled.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8794}"

echo "Servíruji $ROOT/site"
echo "http://localhost:$PORT/"
exec python3 "$ROOT/server.py" "$ROOT/site" "$PORT"
