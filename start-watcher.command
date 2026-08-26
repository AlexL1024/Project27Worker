#!/bin/bash
#
#  Starts the Project27 watcher: requests committed from the iPad in, worlds on
#  GitHub out. Works from any network — nothing dials into this Mac.
#  Double-click, or run from Terminal. Ctrl-C (or close the window) to stop.
#
cd "$(dirname "$0")"
exec python3 tools/watcher.py
