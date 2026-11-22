"""Headless browser smoke test: title, setup, game start, several turns, screenshots, console errors."""
import sys, asyncio
from playwright.async_api import async_playwright
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
CHROME = os.environ.get('CHROME')  # optional path to a Chrome binary; default: Playwright's Chromium

OUT = ROOT / 'test' / 'shots'
OUT.mkdir(exist_ok=True)

async def run(name, vp, mobile, turns):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
        page = await ctx.new_page()
        errs = []
        page.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.goto(URL)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f'{OUT}/{name}_1_title.png')
        await page.click('[data-act=newgame]')
        await page.wait_for_timeout(300)
        await page.click('[data-act=setfac][data-id=synode]')
        await page.click('[data-act=start]')
        await page.wait_for_timeout(1200)
        await page.screenshot(path=f'{OUT}/{name}_2_intro.png')
        await page.click('#modal [data-act=closeModal]')
        await page.wait_for_timeout(500)
        await page.screenshot(path=f'{OUT}/{name}_3_start.png')
        # pick research
        await page.click('#researchBtn')
        await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/{name}_4_research.png')
        await page.click('#modal [data-act=pickTech]')
        # select capital system via JS helper
        await page.evaluate('selectSystem(UI.G.empires[0].capital)')
        await page.wait_for_timeout(400)
        await page.screenshot(path=f'{OUT}/{name}_5_capital.png')
        # queue a colony ship & building
        await page.evaluate("""() => { const G = UI.G; const c = G.colonies.find(c => c.emp === 0); try { queueShip(G, c.id, 'kolonie'); } catch(e) {} refresh(); }""")
        for t in range(turns):
            await page.evaluate("""() => { if (UI.G.pending.length) { while (UI.G.pending.some(p => p.emp === 0)) { const i = UI.G.pending.findIndex(p => p.emp === 0); resolvePending(UI.G, i, 0); } closeModal(); }
              const e = UI.G.empires[0]; if (!e.research.current) chooseResearch(UI.G, 0, e.research.options[0]);
              aiTurn(UI.G, e); endTurn(); }""")
            await page.wait_for_timeout(120)
            await page.evaluate("() => { R.anim = null; if (R.onAnimDone) { const cb = R.onAnimDone; R.onAnimDone = null; cb(); } }")
            if UI_over := await page.evaluate('!!UI.G.over'):
                break
        await page.wait_for_timeout(600)
        await page.evaluate('closeModal(); deselect(); R.cam.z = 0.55; R.cam.x = UI.G.w/2; R.cam.y = UI.G.h/2;')
        await page.wait_for_timeout(500)
        await page.screenshot(path=f'{OUT}/{name}_6_after.png')
        await page.evaluate('focusCapital(); R.cam.z = 1.4; R.target = null; const s = UI.G.systems[UI.G.empires[0].capital]; R.cam.x = s.x; R.cam.y = s.y; selectSystem(s.id)')
        await page.wait_for_timeout(500)
        await page.screenshot(path=f'{OUT}/{name}_7_zoom.png')
        await page.evaluate('deselect(); showDiplomacy()')
        await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/{name}_8_diplo.png')
        await page.evaluate("showEmpire('scores')")
        await page.wait_for_timeout(300)
        await page.screenshot(path=f'{OUT}/{name}_9_scores.png')
        info = await page.evaluate('({turn: UI.G.turn, over: UI.G.over, cols: coloniesOf(UI.G,0).length, sys: systemsOf(UI.G,0).length})')
        print(name, info)
        print('ERRORS:', errs[:20])
        await b.close()

name = sys.argv[1] if len(sys.argv) > 1 else 'desk'
turns = int(sys.argv[2]) if len(sys.argv) > 2 else 30
if name == 'mob':
    asyncio.run(run('mob', {'width': 390, 'height': 844}, True, turns))
else:
    asyncio.run(run('desk', {'width': 1366, 'height': 820}, False, turns))
