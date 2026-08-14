#!/usr/bin/env python3
"""Build an edit decision list (EDL) from ranked takes + silence cuts: the strongest
line goes to 0:00, silence is removed at thought boundaries, and the payoff beat is
held intact even if it runs long.

The output is a plain JSON list of ordered segments — human-readable on purpose, per
playbooks/nick-saraev.md ("you want to see why a cut happened").

Usage:
    python cut_plan.py ranked.json silences/*.json -o plan.json --focus "one-sentence focus"
"""
import argparse
import json
from pathlib import Path


def load_silences(paths: list[Path]) -> dict[str, list[dict]]:
    by_source = {}
    for p in paths:
        data = json.loads(p.read_text())
        by_source[data["source"]] = data["cuts"]
    return by_source


def subtract_range(segments: list[dict], source: str, cut_start: float, cut_end: float) -> list[dict]:
    """Remove [cut_start, cut_end) from any segment on `source`, trimming (and, for a
    cut in the middle, splitting) rather than dropping the whole segment — a segment
    can extend well past the overlap and that footage must survive."""
    result = []
    for seg in segments:
        if seg["source"] != source or seg["end"] <= cut_start or seg["start"] >= cut_end:
            result.append(seg)
            continue
        if seg["start"] < cut_start:
            result.append({**seg, "end": cut_start})
        if seg["end"] > cut_end:
            result.append({**seg, "start": cut_end})
    return [s for s in result if s["end"] - s["start"] > 0.01]


def segments_for_take(source: str, duration: float, cuts: list[dict], role: str) -> list[dict]:
    """Turn a take's silence cuts into keep-segments, tagged with the beat role."""
    cuts = sorted(cuts, key=lambda c: c["start"])
    keep = []
    cursor = 0.0
    for c in cuts:
        if c["start"] > cursor:
            keep.append({"source": source, "start": round(cursor, 3), "end": round(c["start"], 3)})
        cursor = max(cursor, c["end"])
    if cursor < duration:
        keep.append({"source": source, "start": round(cursor, 3), "end": round(duration, 3)})

    for seg in keep:
        seg["role"] = role
    return keep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ranked", type=Path, help="output of rank_takes.py")
    ap.add_argument("silences", type=Path, nargs="+", help="output(s) of silence_cuts.py")
    ap.add_argument("-o", "--output", type=Path, required=True)
    ap.add_argument("--focus", required=True, help="one-sentence statement of what this video is about")
    args = ap.parse_args()

    ranked = json.loads(args.ranked.read_text())
    silences = load_silences(args.silences)

    best_take = next(t for t in ranked["ranked_takes"] if t["source"] == ranked["best_take"])
    payoff = ranked.get("best_payoff_segment")
    hook = ranked.get("best_hook_segment")

    # Cap body generation at the end of the payoff (= the last sentence, i.e. the end
    # of actual speech) rather than the take's raw audio duration — otherwise trailing
    # dead air after the last word becomes a spurious "body" segment.
    content_end = payoff["end"] if payoff and payoff["source"] == best_take["source"] else best_take["duration"]

    body_cuts = silences.get(best_take["source"], [])
    body_segments = segments_for_take(best_take["source"], content_end, body_cuts, role="body")

    if hook:
        # Trim (not drop) whatever part of the body overlaps the hook we already
        # placed at 0:00 — the rest of that segment may extend well past the hook.
        body_segments = subtract_range(body_segments, hook["source"], hook["start"], hook["end"])

    if payoff:
        body_segments = subtract_range(body_segments, payoff["source"], payoff["start"], payoff["end"])

    # Explicit order: hook first, body in chronological order, payoff last — rather
    # than relying on append order, which subtract_range's splitting can disturb.
    body_segments.sort(key=lambda s: (s["source"], s["start"]))

    # Drop slivers too short to be a real cut (leftover silence-trim buffer butting up
    # against a hook/payoff boundary) — not worth a clip in the render.
    min_segment = 0.12
    body_segments = [s for s in body_segments if s["end"] - s["start"] >= min_segment]

    plan_segments = []
    if hook:
        plan_segments.append({"source": hook["source"], "start": hook["start"], "end": hook["end"], "role": "hook"})
    plan_segments.extend(body_segments)
    if payoff:
        plan_segments.append({
            "source": payoff["source"],
            "start": payoff["start"],
            "end": payoff["end"],
            "role": "payoff",
            "hold": True,  # never trimmed by render.py
        })

    total_duration = sum(s["end"] - s["start"] for s in plan_segments)

    plan = {
        "focus": args.focus,
        "segments": plan_segments,
        "estimated_duration": round(total_duration, 2),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plan, indent=2))
    print(f"cut plan: {len(plan_segments)} segments, ~{plan['estimated_duration']}s -> {args.output}")


if __name__ == "__main__":
    main()
