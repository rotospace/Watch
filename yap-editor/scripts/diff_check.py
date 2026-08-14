#!/usr/bin/env python3
"""Self-check required by CLAUDE.md step 8: re-transcribe the rendered output and diff
its word sequence against what the cut plan says should be there. Never mark a render
"done" without running this and it passing.

Usage:
    python diff_check.py plan.json rendered.mp4 --transcripts-dir transcripts
"""
import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

from transcribe import transcribe


def expected_words(plan: dict, transcripts_dir: Path) -> list[str]:
    words = []
    for seg in plan["segments"]:
        stem = Path(seg["source"]).stem
        transcript_path = transcripts_dir / f"{stem}.json"
        if not transcript_path.exists():
            continue
        data = json.loads(transcript_path.read_text())
        words.extend(
            w["word"].lower().strip(".,!?")
            for w in data["words"]
            if seg["start"] <= w["start"] < seg["end"]
        )
    return words


def actual_words(rendered_path: Path, model_size: str) -> list[str]:
    result = transcribe(rendered_path, model_size)
    return [re.sub(r"[^\w']", "", w["word"].lower()) for w in result["words"] if w["word"].strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan", type=Path)
    ap.add_argument("rendered", type=Path)
    ap.add_argument("--transcripts-dir", type=Path, default=Path("transcripts"))
    ap.add_argument("--model", default="small")
    ap.add_argument("--threshold", type=float, default=0.9, help="minimum similarity ratio to pass")
    args = ap.parse_args()

    plan = json.loads(args.plan.read_text())
    expected = expected_words(plan, args.transcripts_dir)
    actual = actual_words(args.rendered, args.model)

    ratio = SequenceMatcher(None, expected, actual).ratio()
    passed = ratio >= args.threshold

    print(f"similarity: {ratio:.3f} (threshold {args.threshold})")
    print(f"expected words: {len(expected)}, actual words: {len(actual)}")

    if not passed:
        matcher = SequenceMatcher(None, expected, actual)
        print("mismatches:")
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag != "equal":
                print(f"  {tag}: expected {expected[i1:i2]!r} -> actual {actual[j1:j2]!r}")

    print("PASS" if passed else "FAIL")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
