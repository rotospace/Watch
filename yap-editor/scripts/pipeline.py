#!/usr/bin/env python3
"""End-to-end orchestrator for the process in ../CLAUDE.md: transcribe every raw take,
rank them, build a cut plan, render, publish the review page, and self-check — then
stop and wait for approval. This is what /edit runs.

Usage:
    python pipeline.py --raw raw/ --focus "one-sentence focus" [--session session1]
"""
import argparse
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent


def sh(*args: str):
    print(f"$ {' '.join(args)}")
    subprocess.run(args, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, default=Path("raw"))
    ap.add_argument("--focus", required=True)
    ap.add_argument("--session", default=f"session-{int(time.time())}")
    ap.add_argument("--model", default="small")
    ap.add_argument("--skip-diff-check", action="store_true")
    args = ap.parse_args()

    raw_files = sorted(p for p in args.raw.iterdir() if p.is_file() and not p.name.startswith("."))
    if not raw_files:
        sys.exit(f"no raw takes in {args.raw}")

    transcripts_dir = Path("transcripts")
    silences_dir = Path("silences")
    out_dir = Path.home() / "Downloads" / "yap-editor" / args.session
    out_dir.mkdir(parents=True, exist_ok=True)

    transcript_paths = []
    for raw_file in raw_files:
        t_path = transcripts_dir / f"{raw_file.stem}.json"
        sh(sys.executable, str(HERE / "transcribe.py"), str(raw_file), "-o", str(t_path), "--model", args.model)
        transcript_paths.append(t_path)

        s_path = silences_dir / f"{raw_file.stem}.json"
        sh(sys.executable, str(HERE / "silence_cuts.py"), str(t_path), "-o", str(s_path))

    ranked_path = Path("ranked.json")
    sh(sys.executable, str(HERE / "rank_takes.py"), *map(str, transcript_paths), "-o", str(ranked_path))

    plan_path = out_dir / "plan.json"
    silence_paths = [silences_dir / f"{p.stem}.json" for p in raw_files]
    sh(sys.executable, str(HERE / "cut_plan.py"), str(ranked_path), *map(str, silence_paths),
       "-o", str(plan_path), "--focus", args.focus)

    existing = list(out_dir.glob("version-*.mp4"))
    version_n = len(existing) + 1
    rendered_path = out_dir / f"version-{version_n}.mp4"
    sh(sys.executable, str(HERE / "render.py"), str(plan_path), "-o", str(rendered_path),
       "--transcripts-dir", str(transcripts_dir))

    if not args.skip_diff_check:
        sh(sys.executable, str(HERE / "diff_check.py"), str(plan_path), str(rendered_path),
           "--transcripts-dir", str(transcripts_dir), "--model", args.model)

    sh(sys.executable, str(HERE / "build_review_page.py"), "--add", str(rendered_path), "--focus", args.focus)

    print(f"\nrendered {rendered_path}")
    print("review page updated — run scripts/server.py (or /rc) and wait for approval.")
    print("nothing is final until it's approved there.")


if __name__ == "__main__":
    main()
