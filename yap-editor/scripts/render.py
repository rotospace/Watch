#!/usr/bin/env python3
"""Render a cut plan: trim + concat the planned segments, pad to landscape on a black
background, and burn in lowercase captions on the lower third.

Requires ffmpeg (with libass, present in any normal ffmpeg build) on PATH.

Usage:
    python render.py plan.json -o ~/Downloads/yap-editor/session1/version-1.mp4
        [--transcripts-dir transcripts] [--width 1920] [--height 1080]
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def run(cmd: list[str]):
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def ffprobe_dims(path: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height", "-of", "csv=p=0:s=x", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    w, h = out.split("x")
    return int(w), int(h)


def trim_segment(seg: dict, out_path: Path):
    run([
        "ffmpeg", "-y", "-ss", str(seg["start"]), "-to", str(seg["end"]),
        "-i", seg["source"],
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        str(out_path),
    ])


def build_concat(clip_paths: list[Path], list_file: Path):
    list_file.write_text("".join(f"file '{p.resolve()}'\n" for p in clip_paths))


def load_words_in_range(transcripts_dir: Path, source: str, start: float, end: float) -> list[dict]:
    stem = Path(source).stem
    transcript_path = transcripts_dir / f"{stem}.json"
    if not transcript_path.exists():
        return []
    data = json.loads(transcript_path.read_text())
    return [w for w in data["words"] if start <= w["start"] < end]


def ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:d}:{m:02d}:{s:05.2f}"


def build_captions(plan: dict, transcripts_dir: Path, ass_path: Path, width: int, height: int):
    # PlayResX/Y must match the actual render resolution — without them libass falls
    # back to its own default script canvas and scales the font wildly wrong (giant,
    # multi-line text instead of a compact lower-third line).
    lines = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {width}", f"PlayResY: {height}", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV",
        f"Style: Caption,Arial,{round(height * 0.05)},&H00FFFFFF,&H00000000,1,3,0,2,60,60,{round(height * 0.08)}",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Text",
    ]

    cursor = 0.0
    for seg in plan["segments"]:
        seg_dur = seg["end"] - seg["start"]
        words = load_words_in_range(transcripts_dir, seg["source"], seg["start"], seg["end"])

        # Group words into ~5-word caption chunks so the lower third doesn't overflow.
        chunk = []
        for w in words:
            chunk.append(w)
            is_last = w is words[-1]
            if len(chunk) >= 5 or is_last:
                rel_start = cursor + (chunk[0]["start"] - seg["start"])
                rel_end = cursor + (chunk[-1]["end"] - seg["start"])
                text = " ".join(c["word"] for c in chunk).lower()
                lines.append(f"Dialogue: 0,{ass_time(rel_start)},{ass_time(rel_end)},Caption,{text}")
                chunk = []

        cursor += seg_dur

    ass_path.write_text("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan", type=Path)
    ap.add_argument("-o", "--output", type=Path, required=True)
    ap.add_argument("--transcripts-dir", type=Path, default=Path("transcripts"))
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    args = ap.parse_args()

    plan = json.loads(args.plan.read_text())
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        clip_paths = []
        for i, seg in enumerate(plan["segments"]):
            clip_path = tmp / f"seg{i:03d}.mp4"
            trim_segment(seg, clip_path)
            clip_paths.append(clip_path)

        concat_list = tmp / "concat.txt"
        build_concat(clip_paths, concat_list)
        concat_out = tmp / "concat.mp4"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
             "-c", "copy", str(concat_out)])

        w, h = args.width, args.height
        ass_path = tmp / "captions.ass"
        build_captions(plan, args.transcripts_dir, ass_path, w, h)

        pad_filter = (
            f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,"
            f"ass={ass_path.as_posix()}"
        )
        run([
            "ffmpeg", "-y", "-i", str(concat_out),
            "-vf", pad_filter,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            str(args.output),
        ])

    print(f"rendered -> {args.output}")


if __name__ == "__main__":
    main()
