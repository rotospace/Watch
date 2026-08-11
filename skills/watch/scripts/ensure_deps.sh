#!/usr/bin/env bash
# Make sure yt-dlp and ffmpeg are available before /watch runs.
# macOS: installs both via Homebrew automatically.
# Linux/Windows (WSL): prints the exact command to paste, then exits non-zero
# so the caller knows setup isn't finished yet.
set -euo pipefail

need_install=()
command -v yt-dlp >/dev/null 2>&1 || need_install+=("yt-dlp")
command -v ffmpeg >/dev/null 2>&1 || need_install+=("ffmpeg")

if [ ${#need_install[@]} -eq 0 ]; then
  echo "ok: yt-dlp and ffmpeg are already installed."
  exit 0
fi

os="$(uname -s)"

if [ "$os" = "Darwin" ]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "error: Homebrew is required to auto-install ${need_install[*]} on macOS." >&2
    echo "install Homebrew first: https://brew.sh" >&2
    exit 1
  fi
  echo "installing missing tools via Homebrew: ${need_install[*]}"
  brew install "${need_install[@]}"
  exit 0
fi

echo "missing: ${need_install[*]}"
echo "run the command that matches your system, then re-run /watch:"
echo ""
if [ "$os" = "Linux" ]; then
  echo "  # Debian/Ubuntu"
  echo "  sudo apt-get update && sudo apt-get install -y ffmpeg python3-pip && pip3 install --user yt-dlp"
  echo ""
  echo "  # Fedora"
  echo "  sudo dnf install -y ffmpeg python3-pip && pip3 install --user yt-dlp"
  echo ""
  echo "  # Arch"
  echo "  sudo pacman -S --noconfirm ffmpeg python-pip && pip install --user yt-dlp"
else
  echo "  # Windows (winget)"
  echo "  winget install ffmpeg yt-dlp.yt-dlp"
fi
exit 1
