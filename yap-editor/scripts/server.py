#!/usr/bin/env python3
"""Local review server: serves review/index.html, streams the actual rendered videos
from wherever they live on disk, and handles approve/deny.

Run locally, then either open http://localhost:8787 on your phone over the same
Wi-Fi, or expose it over the internet with a Cloudflare tunnel — see /rc in
../.claude/commands/rc.md, or run directly:

    cloudflared tunnel --url http://localhost:8787

Optional: set NTFY_TOPIC to get a push notification (via ntfy.sh, no account needed)
whenever a version is approved or denied, so you find out on your phone without
needing to keep the page open.

Usage:
    python server.py [--port 8787] [--review-dir review]
"""
import argparse
import json
import os
import urllib.request
from pathlib import Path

from flask import Flask, Response, abort, send_file

from build_review_page import load_state, render_html, save_state

app = Flask(__name__)
REVIEW_DIR = Path("review")


def notify(text: str):
    topic = os.environ.get("NTFY_TOPIC")
    if not topic:
        return
    try:
        urllib.request.urlopen(
            urllib.request.Request(f"https://ntfy.sh/{topic}", data=text.encode(), method="POST"),
            timeout=5,
        )
    except OSError:
        pass  # best-effort notification only


@app.get("/")
def index():
    state = load_state(REVIEW_DIR)
    return render_html(state)


@app.get("/video/<version_id>")
def video(version_id):
    state = load_state(REVIEW_DIR)
    match = next((v for v in state if v["id"] == version_id), None)
    if not match:
        abort(404)
    path = Path(match["path"])
    if not path.exists():
        abort(404)
    return send_file(path, mimetype="video/mp4", conditional=True)


def _set_status(version_id: str, status: str):
    state = load_state(REVIEW_DIR)
    match = next((v for v in state if v["id"] == version_id), None)
    if not match:
        abort(404)
    match["status"] = status
    save_state(REVIEW_DIR, state)
    notify(f"yap-editor: {version_id} {status}")
    return match


@app.post("/approve/<version_id>")
def approve(version_id):
    match = _set_status(version_id, "approved")
    return {"ok": True, "version": match}


@app.post("/deny/<version_id>")
def deny(version_id):
    match = _set_status(version_id, "denied")
    return {"ok": True, "version": match}


@app.get("/state")
def state_json():
    return Response(json.dumps(load_state(REVIEW_DIR)), mimetype="application/json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--review-dir", type=Path, default=Path("review"))
    args = ap.parse_args()

    global REVIEW_DIR
    REVIEW_DIR = args.review_dir
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)

    print(f"review page: http://localhost:{args.port}")
    app.run(host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
