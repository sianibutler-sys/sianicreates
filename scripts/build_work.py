#!/usr/bin/env python3
"""Builds the Work cards from work/projects.json.

Edit work/projects.json, then run:  python3 scripts/build_work.py

- Home page (index.html): the projects marked "featured": true, between
  <!-- work:featured:start --> and <!-- work:featured:end -->, plus the
  "See all work" count.
- Work page (work/index.html): every project, between
  <!-- work:all:start --> and <!-- work:all:end -->, plus the filter counts.

To add a project: add an entry to projects.json, put its desktop screenshot in
assets/img/ (the "image" field) and a square 360x360 phone thumbnail in
assets/img/work/ (the "thumb" field), then run this script.
"""
import json, re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = ["The Hello", "The Front Desk", "The System"]
WORDS = "zero one two three four five six seven eight nine ten eleven twelve".split()


def slugify(t):
    return re.sub(r"[^a-z]+", "-", t.lower()).strip("-")


def e(t):
    return html.escape(t, quote=True)


def card(p, pre, cls="card", lazy=True):
    feats = "".join(f"<li>{e(f)}</li>" for f in p["features"])
    links = f'<a class="link" href="{pre}work/{p["slug"]}/">Read the case study</a>'
    if p.get("url"):
        links += f'<a class="link link--quiet" href="{e(p["url"])}" target="_blank" rel="noopener">Visit the site ↗</a>'
    if p.get("launching_soon"):
        links += '<span class="soon">Launching soon</span>'
    load = ' loading="lazy"' if lazy else ""
    return f"""      <article class="{cls}" data-type="{slugify(p['type'])}">
        <a class="card__shot" href="{pre}work/{p['slug']}/" tabindex="-1" aria-hidden="true">
          <span class="bar"><i></i><i></i><i></i><b>{e(p['bar'])}</b></span>
          <picture><source media="(max-width:760px)" srcset="{pre}assets/img/{p['thumb']}" width="360" height="360"><img src="{pre}assets/img/{p['image']}" alt="{e(p['image_alt'])}"{load} width="1200" height="750"></picture>
        </a>
        <div class="card__body">
          <p class="card__type">{e(p['type'])}</p>
          <p class="card__meta">{e(p['meta'])}</p>
          <h3>{e(p['name'])}</h3>
          <p class="card__lead">{e(p['lead'])}</p>
          <ul class="feats">{feats}</ul>
          <div class="card__links">{links}</div>
        </div>
      </article>"""


def swap(text, key, block):
    a, b = f"<!-- work:{key}:start -->", f"<!-- work:{key}:end -->"
    i, j = text.index(a) + len(a), text.index(b)
    return text[:i] + "\n" + block + "\n      " + text[j:]


def main():
    projects = json.loads((ROOT / "work/projects.json").read_text())
    n = len(projects)

    # home: featured, one per site type, ordered System, Front Desk, Hello
    feat = [p for p in projects if p.get("featured")]
    feat.sort(key=lambda p: -TYPES.index(p["type"]))
    cards = [card(p, "", "card card--wide" if i == 0 else "card") for i, p in enumerate(feat)]
    home = (ROOT / "index.html").read_text()
    home = swap(home, "featured", "\n\n".join(cards))
    home = re.sub(r'(<a class="btn btn--line work__all"[^>]*>)See all work \(\d+\)', rf"\1See all work ({n})", home)
    (ROOT / "index.html").write_text(home)

    # work page: everything
    page = (ROOT / "work/index.html").read_text()
    page = swap(page, "all", "\n\n".join(card(p, "../", lazy=i > 1) for i, p in enumerate(projects)))
    page = re.sub(r'(data-filter="all"[^>]*>All <span>)\d+', rf"\g<1>{n}", page)
    for t in TYPES:
        c = sum(p["type"] == t for p in projects)
        page = re.sub(rf'(data-filter="{slugify(t)}"[^>]*>{re.escape(t)} <span>)\d+', rf"\g<1>{c}", page)
    words = WORDS[n] if n < len(WORDS) else str(n)
    page = re.sub(r'(<span class="work__count">)[^<]*', rf"\g<1>{words.capitalize()} sites so far.", page)
    (ROOT / "work/index.html").write_text(page)
    print(f"Built {len(feat)} featured and {n} total.")


if __name__ == "__main__":
    main()
