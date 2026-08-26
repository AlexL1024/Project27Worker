#!/bin/bash
#
#  Starts the Project27 watcher: requests committed from the iPad in, worlds on
#  GitHub out. Works from any network — nothing dials into this Mac.
#
#  Runs under caffeinate so the Mac stays awake while watching (a MacBook still
#  sleeps if you close the lid — leave it open, or use an always-on machine).
#  Double-click, or run from Terminal. Ctrl-C (or close the window) to stop.
#
cd "$(dirname "$0")"
exec caffeinate -is python3 tools/watcher.py
