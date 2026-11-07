# Regenerate the raster brand assets from frontend/public/xplore-badge.svg.
#
#   python scripts/make-badge-png.py
#
# xplore-badge.png is the og:image / JSON-LD logo; favicon.png is the browser
# tab icon. Both are rendered on a white backing because social cards and tab
# bars don't control the background colour, and a plain transparent dark
# badge would vanish on dark surfaces. The in-app badge is inline SVG and has
# no backing at all — edit xplore-badge.svg first, then re-run this script.

import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / "frontend" / "public" / "xplore-badge.svg"

# og images read best around 512; the favicon only ever shows tiny.
TARGETS = [
    (512, ROOT / "frontend" / "public" / "xplore-badge.png"),
    (256, ROOT / "frontend" / "public" / "favicon.png"),
]


def render(svg_text: str, px: int, out: pathlib.Path) -> None:
    doc = (
        "<!doctype html><html><body style='margin:0'>"
        "<div id='t' style='width:%(px)dpx;height:%(px)dpx;background:#fff;"
        "display:grid;place-items:center'>"
        "<div style='width:%(size)dpx;height:%(size)dpx'>%(svg)s</div>"
        "</div></body></html>"
        % {"px": px, "size": round(px * 0.86), "svg": svg_text}
    )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": px, "height": px})
        page.set_content(doc)
        page.locator("#t").screenshot(path=str(out))
        browser.close()


def main() -> None:
    svg_text = SVG_PATH.read_text(encoding="utf-8")
    # Make the inline copy fill its wrapper box.
    svg_text = svg_text.replace("<svg ", '<svg width="100%" height="100%" ', 1)
    for px, out in TARGETS:
        render(svg_text, px, out)
        print(f"wrote {out.name} at {px}x{px}")


if __name__ == "__main__":
    main()
