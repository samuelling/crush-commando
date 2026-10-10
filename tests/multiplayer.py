# Two-player end-to-end test of the combined game. Start the local server first: node server/dev.js
import asyncio, json, sys
from playwright.async_api import async_playwright
BASE = 'http://localhost:8787/'
INIT = "window.__errs=[]; addEventListener('error', e => __errs.push(String(e.message)+' @'+(e.filename||'').split('/').pop()+':'+e.lineno)); addEventListener('unhandledrejection', e => __errs.push('rej '+e.reason));"
OUT = '/tmp/ccxhd-'
def fr(page, name):
    for f in page.frames:
        if name in f.url: return f
async def ev(f, js): return await f.evaluate(js)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pages = []
        for nm in ['Ann', 'Ben']:
            ctx = await b.new_context(viewport={'width': 960, 'height': 540})
            await ctx.add_init_script(INIT)
            pg = await ctx.new_page()
            pg.on('console', lambda m, nm=nm: print(nm, 'console', m.type, m.text) if m.type in ('error',) else None)
            await pg.goto(BASE + f'?room=t1&name={nm}')
            pages.append(pg)
        A, B = pages
        await A.wait_for_timeout(2500)
        await A.screenshot(path=OUT+'lobby.png')
        for pg in pages: await pg.click('#playCC')
        await A.wait_for_timeout(800)
        ca, cb = fr(A, 'cc/'), fr(B, 'cc/')
        for f in (ca, cb): await ev(f, "startStage(0,0); G.overlay=null; 0")
        await A.wait_for_timeout(1500)
        print('A peers here', await ev(ca, "netHere().map(q=>q.name+' '+q.s.loc)"), 'B peers here', await ev(cb, "netHere().map(q=>q.name+' '+q.s.loc)"))
        # put Ben next to Ann
        await ev(cb, "G.P.x = G.P.x + 30; 0")
        await A.wait_for_timeout(700)
        await A.screenshot(path=OUT+'cc_two.png')
        # friend fire: Ben shoots
        await ev(cb, "kb.fire = true; 0"); await A.wait_for_timeout(500)
        print('A ghost bolts seen', await ev(ca, "G.bolts.filter(b=>b.ghost).length"))
        await A.screenshot(path=OUT+'cc_fire.png')
        await ev(cb, "kb.fire = false; 0")
        # shared kill
        uid = await ev(ca, "(()=>{const e=G.ents.find(e=>e.enemy&&!e.dead&&e.uid); killEnemy(e,false); return e.uid})()")
        await A.wait_for_timeout(500)
        print('kill', uid, 'dead on Ben:', await ev(cb, f"!G.ents.some(e=>e.uid==='{uid}'&&!e.dead)"))
        # host-only troopers
        await A.wait_for_timeout(6000)
        aid = await ev(ca, "NET.me"); bid = await ev(cb, "NET.me")
        print('runners A', await ev(ca, "G.ents.filter(e=>e.type==='runner').map(e=>e.uid)"), 'B', await ev(cb, "G.ents.filter(e=>e.type==='runner').map(e=>e.uid)"), 'ids', aid, bid)
        # portal: Ann walks into the rift
        await ev(ca, "(()=>{const r=G.ents.find(e=>e.type==='rift'); Object.assign(G.P,{x:r.x-30,y:r.y-PH.ph,vx:0,vy:0}); G.inv=5; kb.right=true; return r.x})()")
        await A.wait_for_timeout(2500)
        print('Ann active after rift:', await ev(A, "hub.active"))
        ha = fr(A, 'hd/')
        print('Ann HD state', await ev(ha, "[hollowDash.game.state, hollowDash.game.chapterIdx, Math.round(hollowDash.game.player.cx), JSON.stringify(hollowDash.game.level.portalAt[0])]"))
        await ev(ha, "hollowDash.input.keys.clear(); hollowDash.input.recompute(); 0")
        await A.wait_for_timeout(600)
        await A.screenshot(path=OUT+'hd_arrive.png')
        await B.wait_for_timeout(500)
        print('Ben sees Ann as', await ev(B, "JSON.stringify([...hub.net.peers.values()].map(p=>[p.name,p.st&&p.st.g,p.st&&p.st.label]))"))
        # Ben joins Ann
        await ev(B, "hub.joinFriend(); 0")
        await B.wait_for_timeout(2500)
        hb = fr(B, 'hd/')
        print('Ben active', await ev(B, "hub.active"), 'Ben HD x', await ev(hb, "Math.round(hollowDash.game.player.cx)"), 'Ann HD x', await ev(ha, "Math.round(hollowDash.game.player.cx)"))
        await B.wait_for_timeout(800)
        await B.screenshot(path=OUT+'hd_two.png')
        # HD shared stomp
        r = await ev(ha, "(()=>{const g=hollowDash.game; g.player.invuln=99; const L=g.level; L.ensure(Math.floor(g.player.cx/48)+120); g.sync(); const e=g.enemies.find(e=>!e.dead); if(!e) return null; e.dead=true; g.onKill(e.uid); return e.uid})()")
        await A.wait_for_timeout(500)
        print('HD kill', r, 'on Ben:', await ev(hb, f"(()=>{{const e=hollowDash.game.enemies.find(e=>e.uid==={r}); return e?e.dead:'not spawned on Ben yet (filtered:'+hollowDash.game.netKilled.has({r})+')'}})()") if r is not None else None)
        # Ann walks back into the HD rift (it is behind her)
        await ev(ha, "(()=>{const g=hollowDash.game, pa=g.level.portalAt[0]; g.teleportTo(pa.x+60, pa.y); hollowDash.input.keys.add('ArrowLeft'); hollowDash.input.recompute(); return 0})()")
        await A.wait_for_timeout(2500)
        print('Ann active after HD rift:', await ev(A, "hub.active"), await ev(ca, "(()=>{const r=G.ents.find(e=>e.type==='rift'); return [G.world, G.idx, Math.round(G.P.x+5-r.x)]})()"))
        await ev(ca, "netClearInput(); 0")
        # shared boss damage
        await ev(B, "hub.play('cc'); 0"); await B.wait_for_timeout(600)
        for f in (ca, cb): await ev(f, "startStage(0,3); G.overlay=null; G.inv=99; 0")
        await A.wait_for_timeout(1200)
        hp0 = await ev(cb, "G.boss.hp")
        await ev(ca, "bossHit(false); bossHit(false); 0")
        await A.wait_for_timeout(600)
        print('boss hp on Ben', hp0, '->', await ev(cb, "G.boss.hp"), ' Ann:', await ev(ca, "G.boss.hp"))
        await A.screenshot(path=OUT+'boss_two.png')
        # FP view with a ghost
        for f in (ca, cb): await ev(f, "startStage(0,0); G.overlay=null; 0")
        await A.wait_for_timeout(400)
        await ev(ca, "(()=>{const z=G.L.fpZones[0]; Object.assign(G.P,{x:z[0]+40}); return 0})()")
        await ev(cb, "(()=>{const z=G.L.fpZones[0]; Object.assign(G.P,{x:z[0]+110}); return 0})()")
        await A.wait_for_timeout(1500)
        print('modes', await ev(ca, "G.mode"), await ev(cb, "G.mode"))
        await A.screenshot(path=OUT+'fp_two.png')
        for pg, nm in ((A, 'Ann'), (B, 'Ben')):
            for f in pg.frames:
                errs = await f.evaluate("window.__errs||[]")
                if errs: print(nm, f.url.split('/')[-2:], 'ERRORS', errs[:5])
        await b.close()
asyncio.run(main())
