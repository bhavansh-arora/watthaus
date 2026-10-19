#!/usr/bin/env python3
"""Assemble the static site.

Each file in src/pages/ starts with a few `key: value` lines, then a line
with `---`, then the page body. Shared header, footer and icons live in
src/partials/. Finished pages are written to the repo root, which is what gets deployed.

    python3 build.py
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT
SITE_URL = "https://www.watthausstrategy.co.nz"

LAYOUT = """<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#09090a">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Watthaus Strategy">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}/assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
<link rel="icon" type="image/png" href="assets/img/favicon.png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/css/main.css?v={ver}">
{preload}<script>
  (function (h) {{
    h.classList.add('js');
    try {{
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var n = sessionStorage.getItem('wh-nav'); if (n) {{ sessionStorage.removeItem('wh-nav'); h.classList.add('is-entering'); h.setAttribute('data-nav', n); }}
      else if (!sessionStorage.getItem('wh-seen')) h.classList.add('is-loading');
    }} catch (e) {{}}
  }})(document.documentElement);
</script>
{schema}</head>
<body class="{body}">
<a class="skip-link" href="#main">Skip to content</a>
{sprite}
{header}
<main id="main">
{content}
</main>
{footer}
<script src="assets/js/config.js?v={ver}"></script>
<script src="assets/js/main.js?v={ver}" defer></script>
{scripts}</body>
</html>
"""

SCHEMA = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"LocalBusiness","name":"Watthaus Strategy Ltd","url":"https://www.watthausstrategy.co.nz","telephone":"+64 21 090 58051","email":"inquiries@watthausstrategy.co.nz","image":"https://www.watthausstrategy.co.nz/assets/img/og.jpg","address":{"@type":"PostalAddress","streetAddress":"4/51 Point England Road","addressLocality":"Auckland","postalCode":"1072","addressCountry":"NZ"},"areaServed":"New Zealand","sameAs":["https://nz.linkedin.com/company/watthaus-strategy-ltd","https://www.instagram.com/watthaussolar"]}
</script>
"""


def parse(text):
    meta, _, body = text.partition("\n---\n")
    data = {}
    for line in meta.strip().splitlines():
        k, _, v = line.partition(":")
        data[k.strip()] = v.strip()
    return data, body


CTA_DEFAULTS = {
    "cta_label": "Free site assessment",
    "cta_title": "Let's power<br>what's <em>next.</em>",
    "cta_lede": "Answer a few quick questions and get an indicative system, savings estimate and a booked site assessment.",
    "cta_btn": "Get my<br>solar plan",
    "cta_href": "quote.html",
}


def fill_footer(footer, meta):
    for key, default in CTA_DEFAULTS.items():
        footer = footer.replace("{{%s}}" % key, meta.get(key, default))
    return footer


def main():
    import time
    ver = str(int(time.time()))
    sprite = (SRC / "partials/sprite.svg").read_text()
    header = (SRC / "partials/header.html").read_text()
    footer = (SRC / "partials/footer.html").read_text()
    for page in sorted((SRC / "pages").glob("*.html")):
        meta, body = parse(page.read_text())
        active = meta.get("active", "")
        head = re.sub(r"\{\{cur:(\w+)\}\}",
                      lambda m: ' aria-current="page"' if m.group(1) == active else "",
                      header)
        scripts = "".join(f'<script src="assets/js/{s.strip()}?v={ver}" defer></script>\n'
                          for s in meta.get("scripts", "").split(",") if s.strip())
        preload = (f'<link rel="preload" as="image" href="{meta["preload"]}">\n'
                   if meta.get("preload") else "")
        name = page.name
        url = SITE_URL + ("/" if name == "index.html" else "/" + name)
        out = LAYOUT.format(
            title=html.escape(meta["title"]),
            description=html.escape(meta["description"]),
            url=url, site=SITE_URL, ver=ver, preload=preload,
            schema=SCHEMA if name in ("index.html", "contact.html") else "",
            body=meta.get("body", ""), sprite=sprite, header=head,
            content=body.strip(), footer=fill_footer(footer, meta), scripts=scripts,
        )
        (OUT / name).write_text(out)
        print("built", name)


if __name__ == "__main__":
    main()
