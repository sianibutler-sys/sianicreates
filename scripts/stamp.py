#!/usr/bin/env python3
"""Stamps every local CSS, JS, image, video and icon link in the site's pages
with ?v=<first 8 characters of a hash of that file>.

The stamp only changes when the file itself changes, so phones and browsers load
a fresh copy right after a deploy and keep using their saved copy otherwise.

Run after any edit:  python3 scripts/stamp.py
(build_work.py runs it for you.)

Third-party links (https://, //cdn, mailto:, #anchors) and links to pages are left alone.
"""
import hashlib, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = {".css", ".js", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg", ".ico", ".mp4", ".webm", ".woff", ".woff2"}
ATTR = re.compile(r'\b(src|href|poster|data-src|srcset)="([^"]+)"')
_cache = {}


def digest(path):
    if path not in _cache:
        _cache[path] = hashlib.sha1(path.read_bytes()).hexdigest()[:8]
    return _cache[path]


def stamp_url(url, page_dir):
    if re.match(r"^([a-z]+:|//|#)", url):
        return url
    bare = url.split("?", 1)[0].split("#", 1)[0]
    if Path(bare).suffix.lower() not in EXT:
        return url
    target = (ROOT / bare.lstrip("/")) if bare.startswith("/") else (page_dir / bare)
    try:
        target = target.resolve()
        target.relative_to(ROOT)
    except ValueError:
        return url
    if not target.is_file():
        return url
    return f"{bare}?v={digest(target)}"


def stamp_page(page):
    text = page.read_text()
    d = page.parent

    def fix(m):
        attr, val = m.group(1), m.group(2)
        if attr == "srcset":
            parts = []
            for item in val.split(","):
                bits = item.strip().split()
                if bits:
                    bits[0] = stamp_url(bits[0], d)
                parts.append(" ".join(bits))
            return f'{attr}="{", ".join(parts)}"'
        return f'{attr}="{stamp_url(val, d)}"'

    new = ATTR.sub(fix, text)
    if new != text:
        page.write_text(new)
        return True
    return False


def main():
    pages = [p for p in ROOT.rglob("*.html") if ".git" not in p.parts and "node_modules" not in p.parts]
    changed = [p for p in pages if stamp_page(p)]
    print(f"Stamped {len(pages)} pages ({len(changed)} changed).")


if __name__ == "__main__":
    main()
