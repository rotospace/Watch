# Playbook: automated cut pipeline

Focus area: the mechanics of turning raw, unscripted rambling into a tight edit
without hand-cutting every clip — the reasoning behind `scripts/cut_plan.py`.

> Starter synthesis, not a transcript of any specific video. Replace with notes from
> whichever creator you actually study for this.

## Core idea
Editing at scale means the *rules* are automatable even if the judgment calls aren't.
Silence removal, best-line selection, and caption timing should be systematized so a
human only approves/denies — they don't manually trim every clip.

## Rules this maps to code
- Silence above a threshold gets removed automatically, except inside a payoff beat
  (`cut_plan.py`'s `hold_payoff` logic).
- The opening line is chosen by scoring, not by recording order — whatever tests
  strongest as a hook moves to `0:00`.
- Every version gets rendered and queued for review rather than auto-published —
  automation proposes, the human disposes.

## Editing implications
- Favor a pipeline that's consistent and reviewable over one that's "smarter" but
  opaque — you want to be able to see *why* a cut happened (the EDL / cut plan JSON
  should be human-readable).
- Batch: process every take through the same scoring pass, don't hand-pick a favorite
  take first and only fall back to others if it's bad.
