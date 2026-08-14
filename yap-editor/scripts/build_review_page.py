#!/usr/bin/env python3
"""Register a rendered version and regenerate the phone-viewable review page.

State lives in review/state.json (append-only list of versions); the HTML is fully
regenerated from that state each time, so it always lists every version rendered this
session, not just the latest.

Usage:
    python build_review_page.py --add ~/Downloads/yap-editor/session1/version-1.mp4 \
        --focus "one-sentence focus" [--review-dir review]
"""
import argparse
import json
import time
from pathlib import Path

STATE_FILE = "state.json"


def load_state(review_dir: Path) -> list[dict]:
    state_path = review_dir / STATE_FILE
    if state_path.exists():
        return json.loads(state_path.read_text())
    return []


def save_state(review_dir: Path, state: list[dict]):
    (review_dir / STATE_FILE).write_text(json.dumps(state, indent=2))


def render_html(state: list[dict]) -> str:
    rows = []
    for v in reversed(state):  # newest first
        status = v["status"]
        badge = {"pending": "#d9a441", "approved": "#3fa34d", "denied": "#c0392b"}[status]
        rows.append(f"""
        <section class="version">
          <div class="meta">
            <span class="badge" style="background:{badge}">{status}</span>
            <strong>{v['id']}</strong> — {v['focus']}
            <span class="ts">{v['created_at']}</span>
          </div>
          <video controls preload="metadata" src="/video/{v['id']}"></video>
          <div class="actions">
            <button onclick="act('{v['id']}','approve')" {'disabled' if status != 'pending' else ''}>Approve</button>
            <button onclick="act('{v['id']}','deny')" {'disabled' if status != 'pending' else ''}>Deny</button>
          </div>
        </section>""")

    return f"""<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>yap-editor review</title>
<style>
body {{ font-family: -apple-system, sans-serif; background:#111; color:#eee; margin:0; padding:16px; }}
h1 {{ font-size:1.1rem; }}
.version {{ background:#1b1b1b; border-radius:12px; padding:12px; margin-bottom:16px; }}
.meta {{ display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }}
.badge {{ color:#fff; padding:2px 8px; border-radius:999px; font-size:0.75rem; text-transform:uppercase; }}
.ts {{ margin-left:auto; color:#888; font-size:0.8rem; }}
video {{ width:100%; border-radius:8px; background:#000; }}
.actions {{ display:flex; gap:8px; margin-top:8px; }}
button {{ flex:1; padding:10px; border:0; border-radius:8px; font-size:1rem; }}
button:first-child {{ background:#3fa34d; color:#fff; }}
button:last-child {{ background:#c0392b; color:#fff; }}
button:disabled {{ opacity:0.4; }}
</style></head>
<body>
<h1>yap-editor — review</h1>
{''.join(rows) if rows else '<p>No versions rendered yet.</p>'}
<script>
async function act(id, action) {{
  await fetch(`/${{action}}/${{id}}`, {{ method: 'POST' }});
  location.reload();
}}
</script>
</body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--add", type=Path, help="rendered mp4 to register as a new version")
    ap.add_argument("--focus", default="")
    ap.add_argument("--review-dir", type=Path, default=Path("review"))
    args = ap.parse_args()

    args.review_dir.mkdir(parents=True, exist_ok=True)
    state = load_state(args.review_dir)

    if args.add:
        version_id = f"v{len(state) + 1}-{int(time.time())}"
        state.append({
            "id": version_id,
            "path": str(args.add.expanduser().resolve()),
            "focus": args.focus,
            "status": "pending",
            "created_at": time.strftime("%Y-%m-%d %H:%M"),
        })
        save_state(args.review_dir, state)
        print(f"registered {version_id} -> {args.add}")

    (args.review_dir / "index.html").write_text(render_html(state))
    print(f"review page -> {args.review_dir / 'index.html'}")


if __name__ == "__main__":
    main()
