"""Unit tests for skills/watch/scripts/watch.py that don't touch the network."""
import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "skills" / "watch" / "scripts" / "watch.py"

spec = importlib.util.spec_from_file_location("watch", SCRIPT)
watch = importlib.util.module_from_spec(spec)
sys.modules["watch"] = watch
spec.loader.exec_module(watch)


def test_url_detection():
    assert watch.URL_RE.match("https://youtu.be/dQw4w9WgXcQ")
    assert watch.URL_RE.match("http://example.com/video.mp4")
    assert not watch.URL_RE.match("/home/user/video.mp4")
    assert not watch.URL_RE.match("video.mp4")


def test_youtube_detection():
    assert watch.YOUTUBE_RE.match("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert watch.YOUTUBE_RE.match("https://youtu.be/dQw4w9WgXcQ")
    assert not watch.YOUTUBE_RE.match("https://vimeo.com/12345")


def test_vtt_to_transcript(tmp_path):
    vtt = tmp_path / "captions.en.vtt"
    vtt.write_text(
        "WEBVTT\n\n"
        "1\n"
        "00:00:01.000 --> 00:00:03.000\n"
        "Hello there\n\n"
        "2\n"
        "00:00:03.000 --> 00:00:05.000\n"
        "<c>General</c> Kenobi\n"
    )
    text = watch.vtt_to_transcript(vtt)
    assert "[00:00:01] Hello there" in text
    assert "[00:00:03] General Kenobi" in text
    assert "<c>" not in text


def test_extract_frames_naming(tmp_path, monkeypatch):
    # Fake ffmpeg_bin to avoid depending on a real video file in CI.
    calls = {}

    def fake_ffmpeg_bin():
        return "true"  # the `true` binary always succeeds and writes nothing

    monkeypatch.setattr(watch, "ffmpeg_bin", fake_ffmpeg_bin)

    out_dir = tmp_path / "frames"
    # Pre-create frames as ffmpeg would have, since our fake binary writes none.
    out_dir.mkdir()
    (out_dir / "frame_00001.jpg").write_bytes(b"\xff\xd8\xff")
    (out_dir / "frame_00002.jpg").write_bytes(b"\xff\xd8\xff")

    frames = watch.extract_frames(Path("dummy.mp4"), out_dir, duration=4.0, max_frames=40)
    assert len(frames) == 2
    assert frames[0]["t"] == 0.0
    assert frames[0]["path"].endswith("frame_00m00s.jpg")
    assert frames[1]["path"].endswith("frame_00m02s.jpg")
