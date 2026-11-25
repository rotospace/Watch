#!/usr/bin/env python3
"""
watch.py -- turn a video (YouTube URL or local file) into something an
agent can reason about: timestamped frames + a timestamped transcript.

Usage:
    watch.py <url-or-path> [--start SEC] [--end SEC] [--max-frames N] [--out DIR]

Output (printed as JSON on the last stdout line, human summary before it):
    {
      "title": str,
      "duration": float | None,
      "source": "youtube" | "file",
      "transcript_source": "captions" | "gemini" | "none",
      "transcript_path": str,
      "frames_dir": str,
      "frames": [{"t": float, "path": str}, ...]
    }
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import time
import sys
import tempfile
from pathlib import Path

YOUTUBE_RE = re.compile(r"^https?://(www\.)?(youtube\.com|youtu\.be)/", re.IGNORECASE)
URL_RE = re.compile(r"^https?://", re.IGNORECASE)


def which_or_die(tool: str, install_hint: str) -> str:
    path = shutil.which(tool)
    if not path:
        print(
            f"error: required tool '{tool}' not found on PATH.\n"
            f"install it first:\n  {install_hint}\n"
            f"(run skills/watch/scripts/ensure_deps.sh for guided setup)",
            file=sys.stderr,
        )
        sys.exit(2)
    return path


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def ffmpeg_bin() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg  # bundled fallback so the skill works with no system deps

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        which_or_die("ffmpeg", "brew install ffmpeg   # or see ensure_deps.sh")
    return "ffmpeg"


def fetch_youtube_info(url: str, tmpdir: Path) -> dict:
    yt_dlp = which_or_die("yt-dlp", "brew install yt-dlp   # or: pip install yt-dlp")
    proc = run([yt_dlp, "--skip-download", "--dump-json", "--no-warnings", url])
    if proc.returncode != 0:
        print(f"error: yt-dlp could not read '{url}':\n{proc.stderr}", file=sys.stderr)
        sys.exit(2)
    return json.loads(proc.stdout.splitlines()[-1])


def fetch_captions(url: str, tmpdir: Path) -> Path | None:
    """Fetch captions first -- cheapest way to know if we even need Gemini."""
    yt_dlp = shutil.which("yt-dlp")
    out_tpl = str(tmpdir / "captions.%(ext)s")
    run(
        [
            yt_dlp,
            "--skip-download",
            "--write-sub",
            "--write-auto-sub",
            "--sub-lang",
            "en.*,en",
            "--sub-format",
            "vtt",
            "--convert-subs",
            "vtt",
            "-o",
            out_tpl,
            url,
        ]
    )
    matches = sorted(tmpdir.glob("captions*.vtt"))
    return matches[0] if matches else None


def download_video(url: str, tmpdir: Path, start: float | None, end: float | None) -> Path:
    yt_dlp = shutil.which("yt-dlp")
    out_tpl = str(tmpdir / "video.%(ext)s")
    cmd = [
        yt_dlp,
        "-f",
        "bv*[height<=480]+ba/b[height<=480]/best",
        "--merge-output-format",
        "mp4",
        "-o",
        out_tpl,
    ]
    if start is not None or end is not None:
        s = "0" if start is None else str(start)
        e = "inf" if end is None else str(end)
        cmd += ["--download-sections", f"*{s}-{e}", "--force-keyframes-at-cuts"]
    cmd.append(url)
    proc = run(cmd)
    matches = sorted(tmpdir.glob("video.*"))
    if proc.returncode != 0 or not matches:
        print(f"error: yt-dlp could not download '{url}':\n{proc.stderr}", file=sys.stderr)
        sys.exit(2)
    return matches[0]


def probe_duration(path: Path) -> float | None:
    ffmpeg = ffmpeg_bin()
    proc = run([ffmpeg, "-i", str(path)])
    m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", proc.stderr)
    if not m:
        return None
    h, mnt, s = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(s)


def extract_frames(video: Path, out_dir: Path, duration: float | None, max_frames: int) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    interval = 2.0
    if duration:
        interval = max(2.0, duration / max_frames)
    ffmpeg = ffmpeg_bin()
    pattern = str(out_dir / "frame_%05d.jpg")
    proc = run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(video),
            "-vf",
            f"fps=1/{interval}",
            "-q:v",
            "3",
            pattern,
        ]
    )
    frames = []
    for i, f in enumerate(sorted(out_dir.glob("frame_*.jpg"))):
        t = round(i * interval, 2)
        mm, ss = divmod(int(t), 60)
        stamped = out_dir / f"frame_{mm:02d}m{ss:02d}s.jpg"
        f.rename(stamped)
        frames.append({"t": t, "path": str(stamped)})
    if not frames and proc.returncode != 0:
        print(f"error: ffmpeg failed to extract frames:\n{proc.stderr}", file=sys.stderr)
        sys.exit(2)
    return frames


def extract_audio(video: Path, out_dir: Path) -> Path:
    ffmpeg = ffmpeg_bin()
    audio_path = out_dir / "audio.mp3"
    run([ffmpeg, "-y", "-i", str(video), "-vn", "-acodec", "libmp3lame", "-q:a", "4", str(audio_path)])
    return audio_path


def vtt_to_transcript(vtt_path: Path) -> str:
    text = vtt_path.read_text(errors="ignore")
    lines = text.splitlines()
    out = []
    ts_re = re.compile(r"(\d{2}:\d{2}:\d{2})\.\d{3} --> ")
    current_ts = None
    seen = set()
    for line in lines:
        m = ts_re.match(line)
        if m:
            current_ts = m.group(1)
            continue
        line = line.strip()
        if not line or line.upper().startswith(("WEBVTT", "KIND:", "LANGUAGE:")) or line.isdigit():
            continue
        line = re.sub(r"<[^>]+>", "", line)
        if current_ts and (current_ts, line) not in seen:
            seen.add((current_ts, line))
            out.append(f"[{current_ts}] {line}")
    return "\n".join(out)


def transcribe_with_gemini(audio_path: Path) -> str | None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import errors as genai_errors
    except ImportError:
        print(
            "note: GEMINI_API_KEY is set but the 'google-genai' package isn't installed.\n"
            "  pip install google-genai",
            file=sys.stderr,
        )
        return None

    client = genai.Client(api_key=api_key)
    prompt = (
        "Transcribe this audio. Output one line per utterance as "
        "`[HH:MM:SS] text`, using the actual timestamp within the audio. "
        "No commentary, just the timestamped transcript."
    )

    attempts = 2
    for attempt in range(1, attempts + 1):
        try:
            uploaded = client.files.upload(file=str(audio_path))
            response = client.models.generate_content(
                model="gemini-flash-latest",
                contents=[uploaded, prompt],
            )
            return response.text
        except genai_errors.ServerError as e:
            print(f"note: Gemini transcription attempt {attempt}/{attempts} failed: {e}", file=sys.stderr)
            if attempt < attempts:
                time.sleep(5)
        except genai_errors.APIError as e:
            print(f"note: Gemini transcription failed: {e}", file=sys.stderr)
            break

    print(
        "note: falling back to no transcript -- frames are still available.",
        file=sys.stderr,
    )
    return None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("target", help="YouTube URL or local video file path")
    ap.add_argument("--start", type=float, default=None, help="clip start, seconds")
    ap.add_argument("--end", type=float, default=None, help="clip end, seconds")
    ap.add_argument("--max-frames", type=int, default=40)
    ap.add_argument("--out", default=None, help="output directory (defaults to a temp dir)")
    args = ap.parse_args()

    out_dir = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix="watch_"))
    out_dir.mkdir(parents=True, exist_ok=True)

    is_url = bool(URL_RE.match(args.target))
    title = args.target
    duration = None
    transcript_source = "none"
    transcript_text = ""

    if is_url:
        info = fetch_youtube_info(args.target, out_dir)
        title = info.get("title", args.target)
        duration = info.get("duration")

        vtt = fetch_captions(args.target, out_dir)
        if vtt:
            transcript_text = vtt_to_transcript(vtt)
            transcript_source = "captions"

        video_path = download_video(args.target, out_dir, args.start, args.end)
    else:
        video_path = Path(args.target).expanduser().resolve()
        if not video_path.exists():
            print(f"error: no such file: {video_path}", file=sys.stderr)
            sys.exit(2)

    if duration is None:
        duration = probe_duration(video_path)

    frames_dir = out_dir / "frames"
    frames = extract_frames(video_path, frames_dir, duration, args.max_frames)

    if not transcript_text:
        audio_path = extract_audio(video_path, out_dir)
        gemini_text = transcribe_with_gemini(audio_path)
        if gemini_text:
            transcript_text = gemini_text
            transcript_source = "gemini"

    transcript_path = out_dir / "transcript.md"
    if transcript_text:
        transcript_path.write_text(transcript_text)
    else:
        transcript_path.write_text(
            "(no transcript available: no captions found and GEMINI_API_KEY is not set)"
        )

    manifest = {
        "title": title,
        "duration": duration,
        "source": "youtube" if is_url else "file",
        "transcript_source": transcript_source,
        "transcript_path": str(transcript_path),
        "frames_dir": str(frames_dir),
        "frames": frames,
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    print(f"# watched: {title}")
    print(f"duration: {duration}s | transcript: {transcript_source} | frames: {len(frames)}")
    print(f"manifest: {manifest_path}")
    print()
    print("--- transcript ---")
    print(transcript_text or "(none)")
    print("--- frames ---")
    for fr in frames:
        print(f"[{fr['t']}s] {fr['path']}")
    print()
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
