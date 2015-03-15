#!/bin/sh
cd "$(dirname "$0")"
./clean_db.sh
rm -rf node_modules
rm -f .system-setup
rm -f .isos-done
