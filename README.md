# /watch

Give Claude (or Codex, Cursor, Copilot, Gemini CLI, and 50+ other
[Agent Skills](https://github.com/anthropics/skills)-compatible hosts) the
ability to watch any video.

Your coding agent can already browse a repo, but out of the box it can't
watch a video. `/watch` closes that gap: point it at a YouTube URL or a
local file and it hands your agent a title, a timestamped transcript, and
a timestamped set of frames — the same raw material a person would have
after actually watching it.

## Install

| Where you work | Install |
|---|---|
| Claude Code | `/plugin marketplace add rotospace/watch` then `/plugin install watch@watch` |
| Codex, Cursor, Copilot, Gemini CLI, and 50+ others | `npx skills add rotospace/watch -g` |
| Claude on the web | Download the skill from the latest release, then Settings → Skills → **+** |

## Why it works

Underneath it is two tools you already trust:

- **`yt-dlp`** fetches captions first and downloads only what the run
  actually needs.
- **`ffmpeg`** pulls the frames.

On macOS both install themselves on your first `/watch` call through
Homebrew. On Linux and Windows, the setup step prints the exact command
for you to paste.

Prove it works:

```
/watch https://youtu.be/dQw4w9WgXcQ what happens at the 30 second mark?
```

> **Pro tip:** on the web version, turn on "Code execution and file
> creation" first. The skill shells out to `ffmpeg` and `yt-dlp`, so
> without it the upload succeeds and every run fails.

## Wire up the one key you need

Get a free Gemini key — that's the only key in this whole pipeline, and
it's only used as a transcription fallback when a video has no captions.

```bash
export GEMINI_API_KEY="..."     # from https://aistudio.google.com/apikey
pip install google-genai
```

If a video already has captions, `/watch` never touches Gemini — captions
are free, fast, and usually more accurate than a transcription pass.

## How Claude reasons about the output

`/watch` doesn't just dump frames and text at the model — the skill
instructions (`skills/watch/SKILL.md`) tell it to:

1. Treat frames as *what was seen* and the transcript as *what was said*,
   and merge both into a single timeline before drawing any conclusion.
2. Build that timeline as beats — timestamp, what's on screen, what's
   spoken, what changed since the last beat — then read across it for
   structure: how it opens, how it holds attention, where it turns, how
   it closes.
3. Report only what the frames or transcript actually show, marking
   anything inferred as inference and anything the sampling could have
   missed as a gap.
4. Finish with the three highest-signal observations, each citing a
   timestamp.

That's what turns "I read the captions" into something closer to "I
watched it."

## Repo layout

```
.claude-plugin/       Claude Code plugin + marketplace manifest
skills/watch/          the skill itself (SKILL.md + scripts, source of truth)
.agents/plugins/watch  symlink -> skills/watch, for generic Agent Skills hosts
.codex-plugin/watch    symlink -> skills/watch, for Codex
hooks/                 SessionStart hook that checks/installs deps
tests/                 unit tests for the parsing/frame logic (no network)
```

## CLI

The skill is just a thin instruction layer over a plain script you can
also run by hand:

```bash
python3 skills/watch/scripts/watch.py "<youtube-url-or-local-path>" \
  [--start SECONDS] [--end SECONDS] [--max-frames N] [--out DIR]
```

It prints a human-readable summary followed by a JSON manifest
(`title`, `duration`, `transcript_source`, `frames[]`) on the last line.

## License

MIT
