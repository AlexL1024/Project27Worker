#!/usr/bin/env python3
#
#  bridge.py — the prompt bar's way into Claude Code.
#
#  The iPad posts {prompt, images, parent} to /build; this runs `claude -p` in the
#  worker repo, streams what it's doing back as SSE (the same shape worldsmith
#  speaks, so the app's chrome — the orb, the narration — just works), and when
#  the commit is pushed, answers with the world's slug. The app then pulls that
#  world from GitHub like any other.
#
#  Stdlib only. Start it with start-bridge.command, or:  python3 tools/bridge.py
#
import base64
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8788
MODEL = "opus"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFS = os.path.join(REPO, ".refs")           # attached photos land here (gitignored)
CLAUDE = shutil.which("claude")

# One build at a time. A second prompt while one is running gets a plain no —
# two Claude sessions editing one repo is a merge conflict wearing a trench coat.
building = threading.Lock()


def sh(*args, timeout=120):
    """Runs a command in the repo, returns (exit, output)."""
    done = subprocess.run(
        args, cwd=REPO, timeout=timeout,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    return done.returncode, done.stdout.strip()


def manifest():
    try:
        with open(os.path.join(REPO, "worlds", "index.json")) as f:
            return {w["slug"]: w for w in json.load(f).get("worlds", [])}
    except Exception:
        return {}


def save_images(images):
    """Base64 photos to files Claude can look at. Returns their repo-relative paths."""
    shutil.rmtree(REFS, ignore_errors=True)
    paths = []
    os.makedirs(REFS, exist_ok=True)
    for i, encoded in enumerate(images or []):
        path = os.path.join(REFS, f"ref-{i}.jpg")
        with open(path, "wb") as f:
            f.write(base64.b64decode(encoded))
        paths.append(os.path.relpath(path, REPO))
    return paths


def compose(prompt, image_paths, parent):
    """The instruction handed to Claude Code. CLAUDE.md carries the contract;
    this carries only what is specific to this one request."""
    lines = []
    if parent and os.path.exists(os.path.join(REPO, "worlds", f"{parent}.scene.js")):
        lines.append(
            f"Edit the existing world `worlds/{parent}.scene.js` as the person asks. "
            f"Keep its slug and manifest entry (update the name only if the change renames it)."
        )
    else:
        lines.append(
            "Build a NEW three.js world for this request: a new module in worlds/, "
            "a new entry in worlds/index.json. Pick a short evocative kebab-case slug."
        )
    lines.append(f"\nThe request:\n{prompt.strip()}\n")
    if image_paths:
        shown = ", ".join(image_paths)
        lines.append(
            f"Reference photos are at: {shown} — look at them first; they show what "
            f"the person wants the world to look and feel like."
        )
    lines.append(
        "Follow CLAUDE.md exactly: write against the runtime API, aim at the "
        "coral-cay quality bar (real materials, shaders where they earn it, things "
        "that move), run `bash tools/check.sh`, then commit everything (the hook "
        "pushes). Work autonomously — no questions, no pauses.\n"
        "End your final message with exactly one line:  WORLD: <slug>"
    )
    return "\n".join(lines)


def narration_from(event):
    """One short human line out of a stream-json event, or None."""
    if event.get("type") != "assistant":
        return None
    out = []
    for block in event.get("message", {}).get("content", []):
        kind = block.get("type")
        if kind == "text":
            text = block.get("text", "").strip()
            if text:
                out.append(text.splitlines()[0][:160])
        elif kind == "tool_use":
            name = block.get("name", "")
            args = block.get("input", {})
            spot = args.get("file_path") or args.get("command") or ""
            spot = os.path.basename(str(spot).split()[0]) if spot else ""
            out.append(f"{name} {spot}".strip()[:120])
    return " · ".join(out) if out else None


def run_build(prompt, images, parent, emit):
    """The whole build: claude writes, the hook pushes, we say which world."""
    if CLAUDE is None:
        emit({"type": "failed", "reason": "The Mac can't find the `claude` command."})
        return

    # Start from what GitHub has — another machine may have pushed since.
    sh("git", "pull", "--ff-only")
    before = manifest()

    image_paths = save_images(images)
    emit({"type": "narration", "text": "Claude is reading the request…"})

    process = subprocess.Popen(
        [
            CLAUDE, "-p", compose(prompt, image_paths, parent),
            "--model", MODEL,
            "--output-format", "stream-json", "--verbose",
        ],
        cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )

    # Reader threads feed a queue so the SSE stream can send keepalives while
    # Claude thinks — a silent minute must not look like a dead connection. stderr
    # gets its own reader because a full, unread pipe would deadlock the child.
    lines = queue.Queue()
    errors = []
    def read():
        for line in process.stdout:
            lines.put(line)
        lines.put(None)
    def read_errors():
        for line in process.stderr:
            errors.append(line)
    threading.Thread(target=read, daemon=True).start()
    threading.Thread(target=read_errors, daemon=True).start()

    result_text = ""
    while True:
        try:
            line = lines.get(timeout=15)
        except queue.Empty:
            emit(None)      # keepalive comment line
            continue
        if line is None:
            break
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("type") == "result":
            result_text = event.get("result") or ""
        said = narration_from(event)
        if said:
            emit({"type": "narration", "text": said})

    process.wait()
    shutil.rmtree(REFS, ignore_errors=True)

    if process.returncode != 0:
        reason = "".join(errors).strip()[-400:] or "Claude Code exited with an error."
        emit({"type": "failed", "reason": reason})
        return

    # Which world? Claude says so; the manifest diff is the fallback witness.
    after = manifest()
    slug = None
    match = re.search(r"WORLD:\s*([a-z0-9][a-z0-9-]*)", result_text)
    if match and match.group(1) in after:
        slug = match.group(1)
    if slug is None:
        changed = [s for s in after if after[s] != before.get(s)]
        if len(changed) == 1:
            slug = changed[0]
    if slug is None:
        emit({"type": "failed",
              "reason": "The build finished but never said which world it made."})
        return

    # The hook pushes on commit; push again ourselves so 'done' means 'on GitHub',
    # not 'on this Mac'. Idempotent when the hook already did it.
    code, output = sh("git", "push", "origin", "main", timeout=300)
    if code != 0:
        emit({"type": "failed", "reason": f"The world is written but the push failed: {output[-300:]}"})
        return

    world = after[slug]
    emit({"type": "narration", "text": f"Pushed. {world.get('name', slug)} is on GitHub."})
    emit({"type": "finished", "slug": slug,
          "name": world.get("name"), "scene": world.get("scene")})


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[bridge] " + fmt % args + "\n")

    def do_GET(self):
        body = b'{"ok": true, "service": "project27-bridge"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.rstrip("/") != "/build":
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            ask = json.loads(self.rfile.read(size))
        except Exception:
            self.send_error(400)
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()

        def emit(event):
            try:
                if event is None:
                    self.wfile.write(b": keepalive\n\n")
                else:
                    payload = json.dumps(event, ensure_ascii=False)
                    self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                # The iPad hung up. Nothing to do; the build carries on and the
                # world still lands on GitHub for the menu to pull.
                pass

        if not building.acquire(blocking=False):
            emit({"type": "failed", "reason": "A world is already being built — wait for it."})
            return
        try:
            run_build(ask.get("prompt", ""), ask.get("images"), ask.get("parent"), emit)
        except Exception as error:  # noqa: BLE001 — the app must hear about it
            emit({"type": "failed", "reason": f"The bridge tripped: {error}"})
        finally:
            building.release()


if __name__ == "__main__":
    try:
        address = subprocess.run(
            ["ipconfig", "getifaddr", "en0"], capture_output=True, text=True
        ).stdout.strip() or "this Mac's IP"
    except OSError:
        address = "this Mac's IP"
    print(f"Project27 bridge · repo {REPO}")
    print(f"Listening on port {PORT}. In the app, set the builder address to: {address}")
    print("Prompts from the iPad will run `claude` here. Ctrl-C to stop.")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
