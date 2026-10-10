# Headless bots: finish every stage (teleporting to the goal) and beat every boss,
# failing on any page error. Needs: pip install playwright && playwright install chromium
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
BOT = """
window.botBoss = function(w, maxSteps){
  startStage(w,3); let firstWeak=-1, hits=0, lastHp=G.boss.hp;
  for(let s=0;s<maxSteps;s++){
    G.inv=5;
    const B=G.boss;
    if(B && !B.dead && B.weak && G.pstate==='alive'){
      if(firstWeak<0) firstWeak=s;
      const wk=B.weak; G.P.x=wk.x+wk.w/2-5; G.P.y=wk.y-PH.ph-1; G.P.vy=250; G.P.vx=0; G.P.dashT=0;
    }
    update(1/60);
    if(B.hp!==lastHp){hits++; lastHp=B.hp;}
    if(G.scene!=='play' || G.overlay) return {w, steps:s, secs:(s/60).toFixed(1), firstWeak:(firstWeak/60).toFixed(1), overlay:G.overlay, scene:G.scene};
    if(B.dead && B.dying<=0){ const bc=G.ents.find(e=>e.type==='beacon'); if(bc && !bc.lit){ G.P.x=bc.x-5; G.P.y=bc.y-PH.ph-2; G.P.vy=0; } }
  }
  return {w, timeout:true, hp:G.boss.hp, st:G.boss.st, firstWeak};
};
window.botLevel = function(w,i){
  startStage(w,i);
  const bc=G.ents.find(e=>e.type==='beacon');
  for(let s=0;s<600;s++){ G.inv=5; if(s===10){G.P.x=bc.x-30; G.P.y=bc.y-PH.ph-1;} kb.right = s>10; update(1/60); if(G.overlay) { kb.right=false; return {w,i,overlay:G.overlay, width:G.L.w, embers:G.embersTotal, stars:G.L.stars.length, chunks:G.L.chunkIds.join(',')}; } }
  kb.right=false; return {w,i,fail:true};
};
0;
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':960,'height':544})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'net::' not in m.text else None)
        await pg.goto('file://' + str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
        await pg.wait_for_timeout(300)
        await pg.evaluate(BOT)
        for w in range(5):
            for i in range(3):
                print(await pg.evaluate(f'botLevel({w},{i})'))
        for w in range(5):
            print(await pg.evaluate(f'botBoss({w}, 60*240)'))
        print(errs[:20])
        if errs: sys.exit(1)
        await b.close()
asyncio.run(main())
