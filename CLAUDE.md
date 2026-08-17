# Working preferences

## Video/media editing efficiency

- **Batch, don't iterate.** When a request implies multiple variants or steps
  (different speeds, multiple crops, several versions), do them all in one pass
  rather than waiting for a follow-up message per variant. Most turnaround
  slowness is round-trip overhead between messages, not render time.
  - For multiple speed/format variants of the same source, decode once and
    branch (ffmpeg `split`/`asplit` into parallel filter chains, then
    `concat`) instead of running a separate ffmpeg invocation per variant.
- **Preview before final.** For heavy or multi-stage edits, render a cheap,
  fast, low-res/short preview first so direction can be confirmed before
  spending time on the full-quality pass. Trade preview fidelity for speed;
  don't trade final-output fidelity for speed unless asked to.
