#!/usr/bin/env python3
"""Transcribe a raw take with word-level timestamps.

Usage:
    python transcribe.py raw/take1.mp4 -o transcripts/take1.json [--model small]

Requires `faster-whisper` (see ../requirements.txt) and ffmpeg on PATH. The first run
for a given --model downloads weights from Hugging Face, so it needs normal internet
access once, then works offline.
"""
import argparse
import json
import sys
from pathlib import Path


def transcribe(audio_path: Path, model_size: str) -> dict:
    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(audio_path), word_timestamps=True, vad_filter=True)

    words = []
    sentences = []
    for seg in segments:
        seg_words = [
            {"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)}
            for w in (seg.words or [])
        ]
        words.extend(seg_words)
        sentences.append({"text": seg.text.strip(), "start": round(seg.start, 3), "end": round(seg.end, 3)})

    return {
        "source": str(audio_path),
        "language": info.language,
        "duration": info.duration,
        "words": words,
        "sentences": sentences,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path, help="raw take (audio or video)")
    ap.add_argument("-o", "--output", type=Path, required=True)
    ap.add_argument("--model", default="small", help="whisper model size (tiny/base/small/medium/large-v3)")
    args = ap.parse_args()

    if not args.input.exists():
        sys.exit(f"no such file: {args.input}")

    result = transcribe(args.input, args.model)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2))
    print(f"wrote {len(result['words'])} words -> {args.output}")


if __name__ == "__main__":
    main()
