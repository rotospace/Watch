# Playbook summary — distilled checklist

This file is what `CLAUDE.md`, `scripts/rank_takes.py`, and `scripts/cut_plan.py`
actually score against. The five per-creator files in this folder are the reasoning
behind each line item; this file is the compressed, actionable version.

Starter set — swap in your own research the same way this system's original author
did: watch a handful of creators whose talking-head/short-form work you want to sound
like, and rewrite these files from what *they* actually do. The categories below
(hook, structure, engagement, delivery, pipeline) are a reasonable default split, not
a fixed taxonomy.

## Hook (0:00–0:03)
- The strongest single line in the take goes first, full stop — not the line that was
  recorded first, not the "setup" line.
- No throat-clearing: no "hey guys", no restating the topic before the payoff.
- A hook that only works with context from later in the video is not a hook — pick a
  different line or trim it until it stands alone.

## Structure (sub-60s story arc)
1. Hook (0:00–0:03) — the claim or result, stated plainly.
2. Stakes (0:03–0:10) — why this matters / what's broken without it.
3. Escalation / build (middle) — one idea at a time, no tangents.
4. Payoff (final beat) — the twist, the number, the "here's what happened." Never
   trimmed for time.
5. CTA (last 2–3s) — one instruction, not three.

## Engagement devices
- Re-hook attention every 3–5 seconds: a pattern interrupt, a number, a callback to
  the hook line, or a beat change — not constant, but never a flat 8+ second stretch
  of same-energy delivery.
- Emphasize the load-bearing word in each caption line, not every word.
- Rhetorical questions and direct address ("you") over third-person narration.

## Delivery / flow-state
- Prefer the take that sounds like a person talking, not a person reciting — light
  imperfection beats over-rehearsed cadence.
- Keep natural breath gaps before big statements; don't compress every pause to zero.
  That's what separates "cut for pacing" from "cut for silence."
- If two takes are close on content, the one with more consistent pacing (fewer big
  speed swings) wins.

## Cut pipeline mechanics
- Cut silence at thought boundaries (gap aligns with a clause/sentence end in the
  transcript), never mid-breath (gap sits inside a clause that continues after it).
- Default silence threshold: trim gaps longer than 350ms down to 150ms, except payoff
  beats, which are never trimmed.
- Reconstruct the video from the *best segment per beat* across all takes — don't
  force a single take to carry the whole video if another take nails one beat better.
- One focus per video. If raw footage covers two ideas, that's two videos, not one
  with a rushed second half.
