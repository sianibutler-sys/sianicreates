#!/usr/bin/env python3
"""Builds the short looping tile videos (480x600, muted) for phones.

The loop: the site scrolls inside the phone, pauses, fades to the logo card, then fades back.
Needs assets/img/work/<slug>-full.jpg (a full-page phone screenshot at 780px wide),
the tile background from make_tiles.py, and <slug>-brand.jpg.

Run:  python3 scripts/make_videos.py butlers dock
"""
import sys, subprocess, tempfile, math
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import make_tiles as mt

W = mt.W
FPS = 24
OUT = (480, 600)
# how far down the page each loop scrolls, in full-screenshot pixels
SCROLL = {"gvo": 4200, "butlers": 5600, "dock": 3700, "boomin": 3500, "invite": 4300}
# optional first screen that fades into the scrolling page (the sealed envelope)
INTRO = {"invite": "invite-closed.jpg"}


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0, min(1, t)))


def build(slug):
    full = Image.open(W / f"{slug}-full.jpg").convert("RGB")
    full = full.resize((600, round(full.height * 600 / full.width)), Image.LANCZOS)
    depth = round(SCROLL[slug] * 600 / 780)
    bg = mt.BG[slug]()
    frame = mt.FRAME.get(slug, (14, 14, 18))
    brand = Image.open(W / f"{slug}-brand.jpg").convert("RGB").resize(OUT, Image.LANCZOS)
    view_h = 1260
    bar = full.getpixel((300, 2))

    def at(y):
        return mt.phone(bg, slug, frame=frame, raw=full.crop((0, y, 600, y + view_h)), bar_color=bar).resize(OUT, Image.LANCZOS)

    # timeline in seconds
    hold0, scroll, hold1, fade, holdlogo, back = 0.8, 3.4, 0.6, 0.6, 1.2, 0.6
    frames = []
    intro = None
    if slug in INTRO:
        ii = Image.open(W / INTRO[slug]).convert("RGB")
        ii = ii.resize((600, round(ii.height * 600 / ii.width)), Image.LANCZOS)
        intro = mt.phone(bg, slug, frame=frame, raw=ii.crop((0, 0, 600, view_h)), bar_color=bar).resize(OUT, Image.LANCZOS)
        for i in range(round(1.0 * FPS)): frames.append(("intro",))
        for i in range(round(0.5 * FPS)): frames.append(("introfade", i / (0.5 * FPS - 1)))
    for i in range(round(hold0 * FPS)): frames.append(("y", 0))
    for i in range(round(scroll * FPS)): frames.append(("y", round(depth * ease(i / (scroll * FPS - 1)))))
    for i in range(round(hold1 * FPS)): frames.append(("y", depth))
    for i in range(round(fade * FPS)): frames.append(("fade", depth, i / (fade * FPS - 1)))
    for i in range(round(holdlogo * FPS)): frames.append(("logo",))
    for i in range(round(back * FPS)): frames.append(("back", i / (back * FPS - 1)))

    cache = {}
    def get(y):
        if y not in cache: cache[y] = at(y)
        return cache[y]

    with tempfile.TemporaryDirectory() as d:
        for n, f in enumerate(frames):
            if f[0] == "intro": im = intro
            elif f[0] == "introfade": im = Image.blend(intro, get(0), f[1])
            elif f[0] == "y": im = get(f[1])
            elif f[0] == "fade": im = Image.blend(get(f[1]), brand, f[2])
            elif f[0] == "logo": im = brand
            else: im = Image.blend(brand, intro if intro else get(0), f[1])
            im.save(f"{d}/{n:04d}.png")
        out = W / f"{slug}-loop.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{d}/%04d.png",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", "-an", str(out)], check=True)
    print(slug, out.stat().st_size // 1024, "KB,", round(len(frames) / FPS, 1), "s")


if __name__ == "__main__":
    for s in sys.argv[1:] or SCROLL: build(s)
