#!/bin/bash
#
#  install-autostart.command — makes THIS Mac the always-on world builder.
#
#  Installs a LaunchAgent so the watcher starts at login, restarts itself if it
#  ever dies, keeps the Mac awake while running, and logs to
#  ~/Library/Logs/project27-watcher.log. Run once, on the always-on machine.
#
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.project27.watcher.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
PY="$(command -v python3 || echo /usr/bin/python3)"
CAF="$(command -v caffeinate || echo /usr/bin/caffeinate)"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.project27.watcher</string>
  <key>ProgramArguments</key>
  <array>
    <string>$CAF</string><string>-is</string>
    <string>$PY</string><string>$REPO/tools/watcher.py</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/project27-watcher.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/project27-watcher.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Installed. The watcher runs at login now and restarts itself if it dies."
echo "  Watch it work:  tail -f ~/Library/Logs/project27-watcher.log"
echo "  Stop it:        launchctl unload $PLIST"
