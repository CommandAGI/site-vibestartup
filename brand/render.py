#!/usr/bin/env python3
"""Render og.png (1200×630) and touch-icon.png (180×180) from brand/og.html with Playwright.

  python3 brand/render.py            # writes ../og.png and ../touch-icon.png
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CHROME = os.environ.get("CHROME_PATH", "/home/brandonin/.cache/commandagi/chrome-for-testing/156.0.8078.80/chrome-linux-arm64/chrome")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 1200, "height": 900}, device_scale_factor=1)
        await pg.goto("file://" + os.path.join(HERE, "og.html"), wait_until="networkidle")
        await pg.wait_for_timeout(300)
        await pg.locator("#og").screenshot(path=os.path.join(ROOT, "og.png"))
        await pg.locator("#icon").screenshot(path=os.path.join(ROOT, "touch-icon.png"), omit_background=True)
        await b.close()
    print("wrote og.png and touch-icon.png")

asyncio.run(main())
