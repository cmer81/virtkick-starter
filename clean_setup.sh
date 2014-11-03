#!/bin/sh
cd "$(dirname "$0")"
rm -f backend/webvirtmgr.sqlite3
rm -f webapp/db/*.sqlite3
rm -rf node_modules
rm -f .system-setup
rm -f .isos-done
