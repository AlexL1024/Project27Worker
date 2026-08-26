#!/bin/bash
#
#  Starts the Project27 bridge: prompts from the iPad in, worlds on GitHub out.
#  Double-click, or run from Terminal. Ctrl-C (or close the window) to stop.
#
cd "$(dirname "$0")"
exec python3 tools/bridge.py
