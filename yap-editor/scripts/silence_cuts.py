#!/usr/bin/env python3
"""Find cuttable silence in a transcript: gaps between words that land on a thought
boundary (the previous word ends a clause/sentence) rather than mid-breath (the gap
sits inside a continuing thought).

A gap only counts as a thought boundary if the word before it ends with sentence or
clause punctuation (. ! ? , ; : —) OR the gap itself is long enough that it's almost
certainly a full stop even without punctuation in the transcript.

Usage:
    python silence_cuts.py transcripts/take1.json -o silences/take1.json
        [--min-gap 0.35] [--trim-to 0.15] [--payoff-tail 4.0]
"""
import argparse
import json
from pathlib import Path

CLAUSE_END = tuple(".!?,;:—-")


def find_cuts(transcript: dict, min_gap: float, trim_to: float, payoff_tail: float) -> list[dict]:
    words = transcript["words"]
    if not words:
        return []

    duration = transcript.get("duration") or words[-1]["end"]
    payoff_start = max(0.0, duration - payoff_tail)

    cuts = []
    for i in range(len(words) - 1):
        gap_start = words[i]["end"]
        gap_end = words[i + 1]["start"]
        gap = gap_end - gap_start
        if gap < min_gap:
            continue
        if gap_start >= payoff_start:
            continue  # never trim inside the payoff beat

        prev_word = words[i]["word"]
        is_thought_boundary = prev_word.endswith(CLAUSE_END) or gap >= (min_gap * 2.5)
        if not is_thought_boundary:
            continue  # mid-breath — leave it

        cuts.append({
            "start": round(gap_start + trim_to / 2, 3),
            "end": round(gap_end - trim_to / 2, 3),
            "reason": "punctuation" if prev_word.endswith(CLAUSE_END) else "long-pause",
        })

    return [c for c in cuts if c["end"] > c["start"]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript", type=Path)
    ap.add_argument("-o", "--output", type=Path, required=True)
    ap.add_argument("--min-gap", type=float, default=0.35, help="seconds; gaps shorter than this are never cut")
    ap.add_argument("--trim-to", type=float, default=0.15, help="seconds of silence to leave at a cut")
    ap.add_argument("--payoff-tail", type=float, default=4.0, help="seconds at the end of the take treated as the payoff beat and never trimmed")
    args = ap.parse_args()

    transcript = json.loads(args.transcript.read_text())
    cuts = find_cuts(transcript, args.min_gap, args.trim_to, args.payoff_tail)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"source": transcript["source"], "cuts": cuts}, indent=2))
    print(f"found {len(cuts)} cuttable silences -> {args.output}")


if __name__ == "__main__":
    main()
