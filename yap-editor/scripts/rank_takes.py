#!/usr/bin/env python3
"""Score and rank raw takes, and pick the best hook/payoff segment per take so
cut_plan.py can mix the strongest hook from one take with the strongest payoff from
another rather than being stuck with a single take end to end.

Scoring is heuristic and meant to be tuned — see playbooks/SUMMARY.md for what each
signal maps to.

Usage:
    python rank_takes.py transcripts/*.json -o ranked.json
"""
import argparse
import json
import re
from pathlib import Path

FILLERS = {"um", "uh", "like", "you know", "i mean", "sort of", "kind of", "basically"}
NUMBER_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
    "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
    "eighty", "ninety", "hundred", "thousand", "million", "billion", "percent",
}


def word_gaps(words: list[dict]) -> list[float]:
    return [words[i + 1]["start"] - words[i]["end"] for i in range(len(words) - 1)]


def filler_ratio(words: list[dict]) -> float:
    if not words:
        return 1.0
    fillers = sum(1 for w in words if w["word"].lower().strip(".,!?") in FILLERS)
    return fillers / len(words)


def pacing_variance(words: list[dict]) -> float:
    """Lower is more consistent pacing (playbooks/jake-yujune.md)."""
    gaps = word_gaps(words)
    if len(gaps) < 2:
        return 0.0
    mean = sum(gaps) / len(gaps)
    return sum((g - mean) ** 2 for g in gaps) / len(gaps)


def ending_strength(sentences: list[dict]) -> float:
    """Very rough proxy: does the last sentence end with punctuation and have >3 words."""
    if not sentences:
        return 0.0
    last = sentences[-1]["text"].strip()
    words = re.findall(r"\w+", last)
    score = 0.0
    if len(words) >= 4:
        score += 0.5
    if last.endswith((".", "!", "?")):
        score += 0.3
    if not re.search(r"\b(um|uh)\b", last.lower()):
        score += 0.2
    return score


def score_take(transcript: dict) -> dict:
    words = transcript["words"]
    fr = filler_ratio(words)
    pv = pacing_variance(words)
    es = ending_strength(transcript["sentences"])

    # Normalize pacing variance into a 0-1 "consistency" score (lower variance = better).
    consistency = 1.0 / (1.0 + pv)

    total = (1 - fr) * 0.4 + consistency * 0.3 + es * 0.3

    return {
        "source": transcript["source"],
        "score": round(total, 4),
        "filler_ratio": round(fr, 4),
        "pacing_variance": round(pv, 4),
        "ending_strength": round(es, 4),
        "duration": transcript.get("duration"),
    }


def best_segment(sentences: list[dict], want: str) -> dict | None:
    """want: 'hook' picks strongest-looking opening sentence, 'payoff' picks the last."""
    if not sentences:
        return None
    if want == "payoff":
        return sentences[-1]
    # hook: prefer the first sentence unless it's a throat-clear (very short, filler-heavy)
    for s in sentences[:2]:
        words = re.findall(r"\w+", s["text"])
        if len(words) >= 4:
            return s
    return sentences[0]


def sentence_score(sentence: dict, want: str) -> float:
    """Cross-take ranking score. Per playbooks/SUMMARY.md a hook is the *punchiest*
    line, not the longest — so length is a bell curve around a short ideal range, not
    a straight reward. Payoff gets a bonus for containing a concrete number (the
    "twist, the number" the playbook calls out)."""
    text = sentence["text"].strip()
    words = re.findall(r"\w+", text)
    n = len(words)
    if n == 0:
        return -1.0

    ideal_lo, ideal_hi = (4, 9) if want == "hook" else (4, 14)
    if n < ideal_lo:
        length_score = n / ideal_lo
    elif n > ideal_hi:
        length_score = max(0.0, 1 - (n - ideal_hi) / ideal_hi)
    else:
        length_score = 1.0

    filler_count = sum(1 for w in words if w.lower() in FILLERS)
    filler_penalty = filler_count * 0.3

    clean_end_bonus = 0.2 if text.endswith((".", "!", "?")) else 0.0
    has_number = bool(re.search(r"\d", text)) or any(w.lower() in NUMBER_WORDS for w in words)
    number_bonus = 0.2 if want == "payoff" and has_number else 0.0

    return length_score - filler_penalty + clean_end_bonus + number_bonus


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcripts", type=Path, nargs="+")
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()

    ranked = []
    hook_candidates = []
    payoff_candidates = []

    for path in args.transcripts:
        transcript = json.loads(path.read_text())
        s = score_take(transcript)
        s["transcript_path"] = str(path)
        ranked.append(s)

        hook = best_segment(transcript["sentences"], "hook")
        payoff = best_segment(transcript["sentences"], "payoff")
        if hook:
            hook_candidates.append({**hook, "source": transcript["source"], "transcript_path": str(path)})
        if payoff:
            payoff_candidates.append({**payoff, "source": transcript["source"], "transcript_path": str(path)})

    ranked.sort(key=lambda r: r["score"], reverse=True)

    best_hook = max(hook_candidates, key=lambda s: sentence_score(s, "hook"), default=None)
    best_payoff = max(payoff_candidates, key=lambda s: sentence_score(s, "payoff"), default=None)

    out = {
        "ranked_takes": ranked,
        "best_take": ranked[0]["source"] if ranked else None,
        "best_hook_segment": best_hook,
        "best_payoff_segment": best_payoff,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=2))
    print(f"ranked {len(ranked)} takes -> {args.output}")
    if ranked:
        print(f"best overall: {ranked[0]['source']} (score {ranked[0]['score']})")


if __name__ == "__main__":
    main()
