#!/usr/bin/env bash
# StickSolid · a recent static ffmpeg on the GitHub machine, like the PC's (Ubuntu's own is older: its "apad" filled the
# disk once). The BtbN "latest" build is sometimes being rebuilt and comes down broken: try it a few times, then
# John Van Sickle's static build, then Ubuntu's package as the last resort. Prints which one it used.
set -u
try() {   # $1 url, $2 folder name inside the archive (glob)
  for n in 1 2 3; do
    rm -rf /tmp/ff && mkdir -p /tmp/ff
    if curl -fsSL --retry 2 "$1" -o /tmp/ff/a.tar.xz && tar -xJf /tmp/ff/a.tar.xz -C /tmp/ff; then
      d=$(ls -d /tmp/ff/$2 2>/dev/null | head -1)
      if [ -n "$d" ]; then b="$d"; [ -d "$d/bin" ] && b="$d/bin"; echo "$b" >> "$GITHUB_PATH"; "$b/ffmpeg" -version | head -1; return 0; fi
    fi
    echo "ffmpeg: tentativo $n non riuscito da $1"; sleep $((n * 5))
  done
  return 1
}
try https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz "ffmpeg-master-latest-linux64-gpl" && exit 0
try https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz "ffmpeg-*-amd64-static" && exit 0
echo "ffmpeg: uso quello di Ubuntu"
sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg && ffmpeg -version | head -1
