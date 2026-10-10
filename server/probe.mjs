// Smoke test for the deployed room server: two clients join a fresh room and exchange a state.
//   node server/probe.mjs https://crush-commando-mp.<subdomain>.workers.dev
// Prints GitHub Actions annotations so the result shows on the run page.
const base = (process.argv[2] || '').replace(/\/$/, '');
const note = (lvl, msg) => console.log(`::${lvl} title=Multiplayer check::${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const r = await fetch(base + '/');
  note(r.ok ? 'notice' : 'error', `HTTP ${r.status}: ${(await r.text()).trim().slice(0, 120)}`);
} catch (e) { note('error', `HTTP request failed: ${e.cause?.code || ''} ${e.message}`); }

const url = base.replace(/^http/, 'ws') + '/room/probe-' + Date.now().toString(36);
const got = { A: [], B: [] };
function client(name) {
  return new Promise((resolve) => {
    let ws;
    try { ws = new WebSocket(url); } catch (e) { note('error', `${name}: could not create socket: ${e.message}`); resolve(null); return; }
    const t = setTimeout(() => { note('error', `${name}: no connection after 10s`); resolve(null); }, 10000);
    ws.addEventListener('open', () => { clearTimeout(t); ws.send(JSON.stringify({ t: 'hi', name, col: 1 })); resolve(ws); });
    ws.addEventListener('message', (e) => got[name].push(String(e.data)));
    ws.addEventListener('error', (e) => note('error', `${name}: socket error ${e.message || ''}`));
    ws.addEventListener('close', (e) => { if (e.code !== 1000 && e.code !== 1005) note('warning', `${name}: closed ${e.code} ${e.reason}`); });
  });
}
const a = await client('A');
await sleep(800);
const b = await client('B');
await sleep(800);
if (a) a.send(JSON.stringify({ t: 'st', s: { g: 'cc', loc: 'cc:0-0', x: 1 } }));
if (b) b.send('ping');
await sleep(1500);
const ok = got.A.some((m) => m.includes('"welcome"')) && got.B.some((m) => m.includes('"welcome"')) && got.A.some((m) => m.includes('"join"')) && got.B.some((m) => m.includes('"st"')) && got.B.includes('pong');
note(ok ? 'notice' : 'error', ok ? 'Two test players joined a room and saw each other.' : `Relay check failed. A got: ${got.A.join(' | ').slice(0, 300)} || B got: ${got.B.join(' | ').slice(0, 300)}`);
for (const w of [a, b]) try { w && w.close(1000); } catch (_) { /* ignore */ }
await sleep(300);
process.exit(ok ? 0 : 1);
