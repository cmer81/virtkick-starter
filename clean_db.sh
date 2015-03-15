#!/bin/sh
cd "$(dirname "$0")"
rm -f backend/webvirtmgr.sqlite3
rm -f webapp/db/*.sqlite3
