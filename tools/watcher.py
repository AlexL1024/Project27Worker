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
FEED = os.path.join(REPO, ".feed")         # worktree on the `feed` branch
CLAUDE = shutil.which("claude")

FEED_OK = False


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


def sh_feed(*args, timeout=120):
    """A git command inside the feed worktree, with hooks switched off — the
    feed must never trigger the main branch's auto-push."""
    done = subprocess.run(
        ["git", "-c", "core.hooksPath=/dev/null", *args], cwd=FEED, timeout=timeout,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    return done.returncode, done.stdout.strip()


def feed_setup():
    """Stands up the live-progress channel: a one-commit `feed` branch, amended
    and force-pushed, so the play-by-play never lands in the worlds' history."""
    global FEED_OK
    sh("git", "worktree", "prune")
    code, _ = sh("git", "rev-parse", "--verify", "feed")
    if code != 0:
        sh("git", "branch", "feed")
    if not os.path.isdir(FEED):
        code, out = sh("git", "worktree", "add", FEED, "feed")
        if code != 0:
            log(f"live feed disabled: {out[-140:]}")
            return
    FEED_OK = True


class Feed:
    """The lines the iPad shows while a build runs. Pushed at most every 15s."""

    def __init__(self, request_id):
        self.id = request_id
        self.lines = []
        self.pushed = 0.0

    def say(self, text):
        log(text)
        self.lines.append(text)
        self.push()

    def push(self, force=False):
        if not FEED_OK:
            return
        now = time.time()
        if not force and now - self.pushed < 15:
            return
        self.pushed = now
        try:
            with open(os.path.join(FEED, "feed.json"), "w") as f:
                json.dump({"id": self.id, "lines": self.lines[-200:]}, f)
            sh_feed("add", "feed.json")
            sh_feed("commit", "-q", "--amend", "--no-edit", "-m", "feed")
            sh_feed("push", "-q", "-f", "origin", "feed")
        except Exception:
            pass    # the feed is a nicety; a build must never fail over it


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

    feed = Feed(request_id)
    log(f"building {request_id}: {ask.get('prompt', '')[:80]}")
    write_status(request_id, "building")
    feed.push(force=True)      # a fresh, empty feed, so old lines never bleed in

    before = manifest()
    process = subprocess.Popen(
        [CLAUDE, "-p", compose(ask), "--model", MODEL,
         "--output-format", "stream-json", "--verbose"],
        cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )

    # Reader threads for both pipes: a full, unread pipe would deadlock the
    # child, and reading stdout through a queue lets the loop notice silence —
    # a build that says nothing for twenty-five minutes is not thinking, it is
    # hung (or the Mac slept under it), and it must not starve the queue.
    import queue as lineq
    import threading
    error_lines = []
    lines = lineq.Queue()
    def read_out():
        for line in process.stdout:
            lines.put(line)
        lines.put(None)
    def drain():
        for line in process.stderr:
            error_lines.append(line)
    threading.Thread(target=read_out, daemon=True).start()
    threading.Thread(target=drain, daemon=True).start()

    # Everything Claude says is kept on disk, so a failed build is a file to
    # read rather than a mystery to reproduce.
    os.makedirs(LOGS, exist_ok=True)
    transcript = open(os.path.join(LOGS, f"{request_id}.log"), "w")

    STALL = 25 * 60
    last_heard = time.time()
    stalled = False
    result_text = ""
    while True:
        try:
            line = lines.get(timeout=30)
        except lineq.Empty:
            if time.time() - last_heard > STALL:
                stalled = True
                process.kill()
                break
            continue
        if line is None:
            break
        last_heard = time.time()
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
                    feed.say(block["text"].strip().splitlines()[0][:140])
                elif block.get("type") == "tool_use":
                    spot = block.get("input", {}).get("file_path") \
                        or block.get("input", {}).get("command") or ""
                    spot = os.path.basename(str(spot).split()[0]) if spot else ""
                    feed.say(f"{block.get('name', '?')} {spot}".strip()[:120])
    process.wait()

    if stalled:
        transcript.write("\n--- killed: no output for 25 minutes ---\n")
        transcript.close()
        write_status(request_id, "failed",
                     {"reason": "The build went silent for 25 minutes and was stopped "
                                "(did the Mac sleep?). Send the prompt again."},
                     also_remove_request=True)
        return
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
    feed.push(force=True)
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
    feed_setup()
    log(f"Watching GitHub for requests every {POLL}s. Ctrl-C to stop.")

    while True:
        try:
            # Locks a crashed process (or a sandboxed tool that cannot unlink)
            # left behind wedge every git command; anything older than five
            # minutes belongs to no one living.
            for name in ("HEAD.lock", "index.lock", "maintenance.lock"):
                lock = os.path.join(REPO, ".git", name)
                try:
                    if os.path.exists(lock) and time.time() - os.path.getmtime(lock) > 300:
                        os.remove(lock)
                        log(f"cleared stale {name}")
                except OSError:
                    pass

            # Rebase, not fast-forward: the iPad's requests are commits made
            # directly on GitHub, so this repo routinely diverges from origin —
            # local work replays on top and everything pushes together.
            code, output = sh("git", "pull", "--rebase", "-q", "origin", "main")
            if code != 0:
                sh("git", "rebase", "--abort")
                log(f"pull failed: {output.strip()[-160:]}")
            else:
                sh("git", "push", "-q", "origin", "main")
            for request_id in pending():
                serve(request_id)
        except KeyboardInterrupt:
            raise
        except Exception as error:  # noqa: BLE001 — the loop must outlive a bad build
            log(f"tripped: {error}")
        time.sleep(POLL)


if __name__ == "__main__":
    main()
