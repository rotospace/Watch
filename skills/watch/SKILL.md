---
name: watch
description: Give Claude the ability to watch any video (YouTube URL or local file) by extracting timestamped frames and a timestamped transcript, then reasoning over both like someone who actually watched it. Use whenever the user asks you to watch, analyze, summarize, transcribe, or answer questions about a specific video.
---

# /watch

Your coding agent can browse a repo, but out of the box it cannot watch a
video. This skill closes that gap by handing you a title, a timestamped
transcript, and a timestamped set of frames — the same raw material a
person would have after actually watching it.

## When to use this

Trigger on things like:
- `/watch <youtube-url> <question>`
- "watch this video and tell me ..."
- "what happens at the 30 second mark in <url>?"
- "turn this tutorial into a skill/agent"

## How it works

Underneath it is two tools you already trust: `yt-dlp` fetches captions
first and downloads only what the run actually needs, and `ffmpeg` pulls
the frames. If no captions exist, the script falls back to Gemini
(`GEMINI_API_KEY`) for transcription — that's the only API key this
pipeline needs, and it has a free tier.

## Steps

1. **Check dependencies once per session.** Run:
   ```
   bash skills/watch/scripts/ensure_deps.sh
   ```
   On macOS this installs `yt-dlp`/`ffmpeg` via Homebrew automatically if
   missing. On Linux/Windows it prints the exact command for the user to
   paste — if it exits non-zero, tell the user to run that command and
   stop here.

2. **Run the watcher.** Pass the URL or local file path. If the user's
   question names a specific moment ("at the 30 second mark", "in the
   first minute"), pass `--start`/`--end` to keep the run cheap and
   focused instead of processing the whole video:
   ```
   python3 skills/watch/scripts/watch.py "<url-or-path>" [--start SEC] [--end SEC]
   ```
   This prints a human-readable summary (title, duration, transcript
   source, frame list) followed by a JSON manifest on the last line —
   `frames[]` gives you a `path` and timestamp `t` for every extracted
   frame, and `transcript_path` points at the full timestamped transcript.

3. **Actually look at the frames.** Read the transcript file, then use
   your image-reading tool on the frames nearest to whatever the user
   asked about (and a handful spread across the whole video for general
   questions). Don't answer from the transcript alone — the frames are
   what makes this "watching" instead of "reading captions."

4. **Merge frames and transcript into one timeline before concluding
   anything.** Treat frames as what was *seen* and the transcript as what
   was *said*. Build the timeline as beats: `(timestamp, what's on
   screen, what's spoken, what changed since the last beat)`. Then read
   across that timeline for structure — how it opens, how it holds
   attention, where it turns, how it closes.

5. **Report only what the frames or transcript actually show.** Mark
   anything you're inferring as inference, and mark anything the frame
   sampling could plausibly have missed as a gap. Finish your answer with
   the three highest-signal observations, each citing a timestamp.

## Notes

- Prefer a narrow `--start`/`--end` clip whenever the question is about a
  specific moment — it's faster and keeps frame sampling dense where it
  matters.
- If `transcript_source` in the manifest is `"none"`, say so plainly
  rather than guessing at dialogue — get the transcript from frames +
  on-screen text only.
- The default sampling caps at 40 frames per run; for a long video this
  means one frame every several seconds, so a moment described in the
  question deserves its own tightly-scoped run rather than relying on
  the wide pass.
