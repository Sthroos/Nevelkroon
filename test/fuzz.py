import asyncio, random, sys
from playwright.async_api import async_playwright
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
CHROME = os.environ.get('CHROME')  # optional path to a Chrome binary; default: Playwright's Chromium
SKIP = {'quit', 'newFromEnd', 'import', 'title', 'newgame', 'continue', 'start', 'setfac', 'setopt'}
async def main(seed, mobile):
    random.seed(seed)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
        page = await (await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile)).new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await page.goto(URL)
        await page.wait_for_timeout(700)
        await page.evaluate("() => { UI.setup = { faction: '%s', size: 'klein', ais: 2, difficulty: 'normaal', name: '<b>x</b>' }; startGame(); }" % random.choice(['aurel','zwerm','synode','tyr','ijzer']))
        await page.wait_for_timeout(500)
        for i in range(400):
            r = random.random()
            if r < 0.55:
                els = await page.query_selector_all('[data-act]')
                vis = []
                for e in els:
                    a = await e.get_attribute('data-act')
                    if a in SKIP: continue
                    if await e.is_visible() and await e.is_enabled(): vis.append(e)
                if vis:
                    try: await random.choice(vis).click(timeout=500)
                    except Exception: pass
            elif r < 0.85:
                await page.mouse.click(random.randint(10, vp['width'] - 10), random.randint(80, vp['height'] - 10))
            elif r < 0.95:
                await page.evaluate("() => { closeModal(); if (UI.G && !UI.G.over) { while (UI.G.pending.some(p => p.emp === 0)) resolvePending(UI.G, UI.G.pending.findIndex(p => p.emp === 0), 0); endTurn(); } }")
                await page.wait_for_timeout(50)
                await page.evaluate("() => { R.anim = null; if (R.onAnimDone) { const cb = R.onAnimDone; R.onAnimDone = null; cb(); } }")
            else:
                await page.mouse.wheel(0, random.choice([-300, 300]))
            if errs: break
        print('seed', seed, 'mobile', mobile, 'turn', await page.evaluate('UI.G ? UI.G.turn : -1'), 'errors', errs[:5])
        await b.close()
asyncio.run(main(int(sys.argv[1]), sys.argv[2] == 'm'))
