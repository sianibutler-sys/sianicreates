#!/usr/bin/env python3
"""Builds the two portrait tile images (800x1000) for each project.

  assets/img/work/<slug>-tile.jpg   the site on a phone, set on the client's own colors or photography
  assets/img/work/<slug>-brand.jpg  the brand card that fades in on hover

Run:  python3 scripts/make_tiles.py            (all projects)
      python3 scripts/make_tiles.py gvo dock   (only these)

Each project gets a recipe in RECIPES below. A new project only needs its
<slug>-mob.jpg (600x1260 phone screenshot) plus a recipe.
"""
import sys
from pathlib import Path
import io
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
W = ROOT / "assets/img/work"
TW, TH = 800, 1000


def img(name):
    return Image.open(W / name).convert("RGB")


def cover(im, w=TW, h=TH):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def grad(top, bot, w=TW, h=TH):
    g = Image.new("RGB", (1, h))
    for y in range(h):
        f = y / (h - 1)
        g.putpixel((0, y), tuple(round(top[i] * (1 - f) + bot[i] * f) for i in range(3)))
    return g.resize((w, h))


def solid(c):
    return Image.new("RGB", (TW, TH), c)


def phone(bg, slug, top=210, width=440, frame=(14, 14, 18), raw=None, bar_color=None):
    """Lay the phone screenshot into a phone frame rising from the bottom of the tile."""
    raw = raw if raw is not None else img(f"{slug}-mob.jpg")
    sw = width
    shot = raw.resize((sw, round(raw.height * sw / raw.width)), Image.LANCZOS)
    # status bar strip above the page, so the island never covers the site's own header
    bar = 46
    top_color = bar_color or raw.getpixel((raw.width // 2, 2))
    screen = Image.new("RGB", (sw, shot.height + bar), top_color)
    screen.paste(shot, (0, bar))
    shot = screen
    sh = shot.height
    b, rad = 14, 54
    pw, ph = sw + 2 * b, sh + 2 * b
    x, y = (TW - pw) // 2, top
    out = bg.copy()
    # shadow
    sm = Image.new("L", (TW, TH), 0)
    ImageDraw.Draw(sm).rounded_rectangle((x + 10, y + 30, x + pw - 10, y + ph + 30), rad, fill=150)
    sm = sm.filter(ImageFilter.GaussianBlur(34))
    out.paste(Image.new("RGB", (TW, TH), (0, 0, 0)), (0, 0), sm)
    # frame
    fm = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(fm).rounded_rectangle((0, 0, pw - 1, ph - 1), rad, fill=255)
    out.paste(Image.new("RGB", (pw, ph), frame), (x, y), fm)
    # screen
    m = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sw - 1, sh - 1), rad - b, fill=255)
    out.paste(shot, (x + b, y + b), m)
    # dynamic island
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((TW // 2 - 50, y + b + 10, TW // 2 + 50, y + b + 38), 14, fill=frame)
    return out


def text_on(bg, src, box, width, lo, hi, y=None, nudge=0):
    """Lift light text out of a screenshot region and lay it on a new background."""
    c = img(src).crop(box)
    r = width / c.width
    c = c.resize((width, round(c.height * r)), Image.LANCZOS)
    m = c.convert("L").point(lambda v: 0 if v < lo else 255 if v > hi else int((v - lo) * 255 / (hi - lo)))
    out = bg.copy()
    out.paste(c, ((TW - c.width) // 2 + nudge, (TH - c.height) // 2 if y is None else y), m)
    return out


def place(bg, part, width, y=None, feather=0):
    r = width / part.width
    part = part.resize((width, round(part.height * r)), Image.LANCZOS)
    out = bg.copy()
    pos = ((TW - part.width) // 2, (TH - part.height) // 2 if y is None else y)
    if feather:
        m = Image.new("L", part.size, 0)
        ImageDraw.Draw(m).rectangle((feather, feather, part.width - feather, part.height - feather), fill=255)
        out.paste(part, pos, m.filter(ImageFilter.GaussianBlur(feather / 2)))
    else:
        out.paste(part, pos)
    return out


def dark(im, a=0.35, c=(0, 0, 0)):
    return Image.blend(im, Image.new("RGB", im.size, c), a)


def logo_png(name, width, tint=None):
    im = Image.open(W / name).convert("RGBA")
    if tint:
        a = im.getchannel("A")
        im = Image.new("RGBA", im.size, tint + (255,)); im.putalpha(a)
    r = width / im.width
    return im.resize((width, round(im.height * r)), Image.LANCZOS)


def logo_svg(svg, width):
    import cairosvg
    png = cairosvg.svg2png(bytestring=svg.encode() if isinstance(svg, str) else svg, output_width=width)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def centered(bg, logo, dy=0):
    out = bg.convert("RGBA")
    out.alpha_composite(logo, ((TW - logo.width) // 2, (TH - logo.height) // 2 + dy))
    return out.convert("RGB")


WAVE = '''<g fill="none" stroke="{c}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><path d="M 15 105 C 30 114, 55 114, 75 98 C 100 78, 115 35, 150 20 C 170 12, 200 14, 222 38"/><path d="M 196 42 C 176 50, 168 76, 184 94 C 198 108, 225 112, 250 110"/></g><circle cx="254" cy="38" r="17" fill="{d}"/>'''


# backgrounds and frame colors shared with make_videos.py
BG = {
    "butlers": lambda: dark(cover(img("butlers-desk.jpg").crop((560, 60, 900, 300))).filter(ImageFilter.GaussianBlur(3)), .2, (20, 30, 45)),
    "dock": lambda: cover(img("dock-desk.jpg").crop((0, 330, 420, 860))),
}
BG["invite"] = lambda: grad((238, 232, 221), (214, 203, 184))
BG["boomin"] = lambda: dark(cover(img("boomin-desk.jpg").crop((1020, 120, 1440, 560))).filter(ImageFilter.GaussianBlur(14)), .35, (40, 20, 10))
FRAME = {"dock": (16, 30, 52), "invite": (22, 34, 58)}

# ---------- recipes ----------

def gvo():
    room = cover(img("gvo-desk.jpg").crop((540, 150, 740, 450))).filter(ImageFilter.GaussianBlur(10))
    tile = phone(dark(room, .25), "gvo")
    bg = grad((22, 18, 36), (8, 8, 12))
    brand = centered(bg, logo_png("gvo-logo.png", 460, (243, 240, 234)))
    return tile, brand


def ajene():
    bg = grad((243, 236, 222), (226, 210, 186))
    tile = phone(bg, "ajene", frame=(40, 32, 26))
    m = img("ajene-mob.jpg")
    word = m.crop((18, 22, 350, 96))
    a, b = word.crop((3, 0, 112, word.height)), word.crop((117, 0, word.width, word.height))
    stack = Image.new("RGB", (b.width, a.height + b.height - 22), (245, 239, 227))
    stack.paste(a, (0, 0)); stack.paste(b, (0, a.height - 22))
    brand = place(solid((245, 239, 227)), stack, 520)
    return tile, brand


def dock():
    tile = phone(BG["dock"](), "dock", frame=FRAME["dock"])
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 130">' + WAVE.format(c="#14253F", d="#E8642C") + '</svg>'
    brand = centered(grad((222, 232, 240), (246, 241, 232)), logo_svg(svg, 500))
    return tile, brand


def butlers():
    tile = phone(BG["butlers"](), "butlers")
    svg = (W / "butlers-logo.svg").read_text()
    bg = dark(cover(img("butlers-mob.jpg").crop((0, 100, 600, 560))).filter(ImageFilter.GaussianBlur(60)), .45, (13, 26, 43))
    brand = centered(bg, logo_svg(svg, 560))
    return tile, brand


def invite():
    tile = phone(BG["invite"](), "invite", frame=FRAME["invite"])
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="146" fill="#14253F"/>'
           '<g transform="translate(46,104) scale(.74)">' + WAVE.format(c="#F4EFE6", d="#E8642C") + '</g></svg>')
    brand = centered(grad((238, 232, 221), (222, 213, 197)), logo_svg(svg, 340))
    return tile, brand


def boomin():
    m = img("boomin-mob.jpg")
    tile = phone(BG["boomin"](), "boomin")
    brand = centered(solid((38, 29, 24)), logo_png("boomin-logo.png", 600))
    return tile, brand


RECIPES = dict(gvo=gvo, ajene=ajene, dock=dock, butlers=butlers, invite=invite, boomin=boomin)

if __name__ == "__main__":
    for slug in sys.argv[1:] or RECIPES:
        tile, brand = RECIPES[slug]()
        tile.save(W / f"{slug}-tile.jpg", quality=84, optimize=True, progressive=True)
        brand.save(W / f"{slug}-brand.jpg", quality=84, optimize=True, progressive=True)
        print("made", slug)
