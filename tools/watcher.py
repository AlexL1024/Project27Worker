#!/usr/bin/env python3
#
#  watcher.py — the GitHub mailbox, Mac side.
#
#  The iPad commits a request into requests/<id>.json (photos beside it in
#  requests/<id>/); this loop notices, runs `claude -p` against the repo's
#  CLAUDE.md contract, and answers through status/<id>.json — building, then
#  done with the world's slug, or failed with a reason. The request is cleaned
#  up in the same commit that closes it, so the repo's history stays mostly
#  worlds.
#
#  Nothing dials in: the Mac only ever pulls from and pushes to GitHub, which
#  is why this works from any network with no ports opened and no VPN.
#
#  Stdlib only. Start it with start-watcher.command, or: python3 tools/watcher.py
#
import json
import os
import re
import shutil
import subprocess
import sys
import time

POLL = 10                      # seconds between looks at the repo
MODEL = os.environ.get("P27_MODEL", "opus")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQUESTS = os.path.join(REPO, "requests")
STATUS = os.path.join(REPO, "status")
LOGS = os.path.join(REPO, "logs")          # gitignored; one file per build
CLAUDE = shutil.which("claude")


def sh(*args, timeout=300, check=False):
    done = subprocess.run(
        args, cwd=REPO, timeout=timeout,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    if check and done.returncode != 0:
        raise RuntimeError(f"{' '.join(args)}: {done.stdout.strip()[-300:]}")
    return done.returncode, done.stdout.strip()


def log(text):
    print(f"[{time.strftime('%H:%M:%S')}] {text}", flush=True)


def manifest():
    try:
        with open(os.path.join(REPO, "worlds", "index.json")) as f:
            return {w["slug"]: w for w in json.load(f).get("worlds", [])}
    except Exception:
        return {}


def write_status(request_id, state, extra=None, also_remove_request=False):
    """One status hop, committed and pushed — this is how the iPad hears back."""
    os.makedirs(STATUS, exist_ok=True)
    payload = {"id": request_id, "state": state,
               "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    payload.update(extra or {})
    with open(os.path.join(STATUS, f"{request_id}.json"), "w") as f:
        json.dump(payload, f, indent=2)

    if also_remove_request:
        # The request has been served; the status file is its tombstone.
        sh("git", "rm", "-q", "--ignore-unmatch", "-r",
           f"requests/{request_id}.json", f"requests/{request_id}")

    sh("git", "add", "-A")
    sh("git", "commit", "-q", "-m", f"status: {request_id} {state}")
    code, output = sh("git", "push", "-q", "origin", "main")
    if code != 0:
        log(f"PUSH FAILED — the iPad can't hear back until this resolves: {output[-200:]}")


def compose(ask):
    """The instruction handed to Claude Code for one request."""
    parent = ask.get("parent")
    request_id = ask["id"]
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
    lines.append(f"\nThe request:\n{ask.get('prompt', '').strip()}\n")

    photos = sorted(
        os.path.join("requests", request_id, name)
        for name in (os.listdir(os.path.join(REQUESTS, request_id))
                     if os.path.isdir(os.path.join(REQUESTS, request_id)) else [])
    )
    if photos:
        lines.append(
            f"Reference photos are at: {', '.join(photos)} — look at them first; "
            f"they show what the person wants the world to look and feel like."
        )
    lines.append(
        "Follow CLAUDE.md exactly: write against the runtime API, aim at the "
        "coral-cay quality bar (real materials, shaders where they earn it, things "
        "that move), run `bash tools/check.sh`, then commit your work. Never "
        "modify or delete anything under requests/ or status/ — they belong to "
        "the mailbox. Work autonomously — no questions, no pauses.\n"
        "End your final message with exactly one line:  WORLD: <slug>"
    )
    return "\n".join(lines)


def serve(request_id):
    """One request, start to finish. Every exit path answers through status/."""
    try:
        with open(os.path.join(REQUESTS, f"{request_id}.json")) as f:
            ask = json.load(f)
        ask["id"] = request_id
    except Exception as error:
        write_status(request_id, "failed",
                     {"reason": f"Unreadable request: {error}"}, also_remove_request=True)
        return

    log(f"building {request_id}: {ask.get('prompt', '')[:80]}")
    write_status(request_id, "building")

    before = manifest()
    process = subprocess.Popen(
        [CLAUDE, "-p", compose(ask), "--model", MODEL,
         "--output-format", "stream-json", "--verbose"],
        cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )

    # stderr gets its own reader: a full, unread pipe would deadlock the child.
    import threading
    error_lines = []
    def drain():
        for line in process.stderr:
            error_lines.append(line)
    threading.Thread(target=drain, daemon=True).start()

    # Everything Claude says is kept on disk, so a failed build is a file to
    # read rather than a mystery to reproduce.
    os.makedirs(LOGS, exist_ok=True)
    transcript = open(os.path.join(LOGS, f"{request_id}.log"), "w")

    result_text = ""
    for line in process.stdout:
        transcript.write(line)
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("type") == "result":
            result_text = event.get("result") or ""
        elif event.get("type") == "assistant":
            for block in event.get("message", {}).get("content", []):
                if block.get("type") == "text" and block.get("text", "").strip():
                    log("  claude: " + block["text"].strip().splitlines()[0][:110])
                elif block.get("type") == "tool_use":
                    spot = block.get("input", {}).get("file_path") \
                        or block.get("input", {}).get("command") or ""
                    log(f"  {block.get('name', '?')} {str(spot)[:80]}")
    process.wait()
    if error_lines:
        transcript.write("\n--- stderr ---\n" + "".join(error_lines))
    transcript.close()

    if process.returncode != 0:
        # The most useful line available: stderr, else Claude's last words, else
        # at least say where the full transcript is.
        reason = "".join(error_lines).strip()[-300:] \
            or result_text.strip()[-300:] \
            or f"Claude Code exited with code {process.returncode} — see logs/{request_id}.log on the Mac."
        log(f"failed {request_id}: {reason[:160]}")
        write_status(request_id, "failed", {"reason": reason}, also_remove_request=True)
        return

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
        write_status(request_id, "failed",
                     {"reason": "The build finished but never said which world it made."},
                     also_remove_request=True)
        return

    world = after[slug]
    log(f"done {request_id}: {world.get('name', slug)}")
    write_status(request_id, "done",
                 {"slug": slug, "name": world.get("name"), "scene": world.get("scene")},
                 also_remove_request=True)


def pending():
    """Request ids with no status yet, oldest commit first (name order is fine —
    the app names them by timestamp)."""
    if not os.path.isdir(REQUESTS):
        return []
    ids = sorted(
        name[:-5] for name in os.listdir(REQUESTS)
        if name.endswith(".json")
    )
    return [i for i in ids if not os.path.exists(os.path.join(STATUS, f"{i}.json"))]


def main():
    if CLAUDE is None:
        sys.exit("The `claude` command isn't installed. npm install -g @anthropic-ai/claude-code")

    log(f"Project27 watcher · repo {REPO}")
    log(f"Watching GitHub for requests every {POLL}s. Ctrl-C to stop.")

    while True:
        try:
            code, _ = sh("git", "pull", "--ff-only", "-q", "origin", "main")
            if code != 0:
                log("pull failed — check network/credentials; retrying.")
            for request_id in pending():
                serve(request_id)
        except KeyboardInterrupt:
            raise
        except Exception as error:  # noqa: BLE001 — the loop must outlive a bad build
            log(f"tripped: {error}")
        time.sleep(POLL)


if __name__ == "__main__":
    main()
