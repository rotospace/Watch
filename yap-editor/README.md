# Yap Editor

Turns Claude Code into a hands-off editor for talking-head short-form video: drop raw
takes in, get back a landscape render with burned-in lowercase lower-third captions,
strongest line moved to `0:00`, silence trimmed at thought boundaries, payoff beats
held intact — reviewed and approved from your phone before anything is final.

This mirrors the setup described in "Turn Claude Code into your Video Editor": five
playbooks distilled from creators studied for talking-head technique, a standing
instruction file (`CLAUDE.md`) that tells Claude Code how to behave as the editor, a
scripted pipeline it drives, and a review page it publishes for approval — plus a
remote-control mode (`/rc`) so approvals can happen from anywhere, not just at your
desk.

## How it fits together

```
raw/            drop your takes here (video or audio files)
playbooks/      house style — what makes a good hook, cut, caption, delivery
CLAUDE.md       the standing instructions Claude Code follows in this project
scripts/        the tools Claude calls: transcribe, rank, cut plan, render, review
review/         generated review page + approve/deny state (git-ignored)
transcripts/    generated word-timestamp transcripts (git-ignored)
.claude/commands/  /edit and /rc slash commands
```

## Setup

```bash
cd yap-editor
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

You also need `ffmpeg` on PATH (`brew install ffmpeg` / `apt install ffmpeg`), and
optionally [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
for phone access to the review page from outside your network.

The first transcription run downloads Whisper model weights from Hugging Face (needs
normal internet once), then runs fully offline.

## Make it yours before using it

The five files in `playbooks/` are starter syntheses, not transcripts of any specific
video — replace them the same way the original build did: watch a handful of creators
whose talking-head style you actually want, take notes, and rewrite those files.
`playbooks/SUMMARY.md` is the compressed checklist the scripts and `CLAUDE.md` both
score against — keep it in sync with whatever you change in the per-creator files.

## Using it

1. Drop one or more takes of the same idea into `raw/`.
2. Open Claude Code in this directory and run `/edit`. It pins a focus, transcribes,
   ranks takes, builds a cut plan, renders, self-checks the render against the plan,
   and publishes a review page — then stops and waits.
3. Open the review page (printed at the end of the run) and approve or deny the
   version. Nothing is final until you do.
4. Off your home network? Run `/rc` instead of opening the page directly — it starts
   the server and a Cloudflare tunnel and gives you a public URL you can open and
   approve/deny from your phone. Set `NTFY_TOPIC=your-topic-name` in the environment
   first if you want a push notification (via the free [ntfy.sh](https://ntfy.sh), no
   account needed) when a new version is ready.

You can also run the pipeline directly without going through Claude Code:

```bash
python scripts/pipeline.py --raw raw/ --focus "one sentence about what this video is"
python scripts/server.py   # then open http://localhost:8787
```

## Manual stages

Each pipeline stage is a standalone script if you want to inspect or rerun one step:

| Script | Does |
|---|---|
| `scripts/transcribe.py` | word-level timestamps for one take |
| `scripts/silence_cuts.py` | finds cuttable silence at thought boundaries |
| `scripts/rank_takes.py` | scores takes, picks best hook/payoff segments |
| `scripts/cut_plan.py` | builds the ordered edit decision list (EDL) |
| `scripts/render.py` | trims, concats, pads to landscape, burns captions |
| `scripts/build_review_page.py` | registers a version, regenerates the review page |
| `scripts/server.py` | serves the review page and handles approve/deny |
| `scripts/diff_check.py` | re-transcribes a render and diffs it against the plan |

The cut plan (`plan.json`) is plain, readable JSON on purpose — you should always be
able to see exactly why a cut happened.
