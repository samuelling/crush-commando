// Cloudflare Worker: wss://<worker>/room/<code> connects to that room's Durable Object.
// Uses the WebSocket Hibernation API, so an idle room costs nothing and plain "ping" keepalives are
// answered by the platform without waking the object.
import { roomOpen, roomMessage, roomClose } from './room.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/room\/([a-z0-9-]{1,32})$/);
    if (!m) return new Response('Crush Commando x Hollow Dash multiplayer server is running.\n', { headers: { 'content-type': 'text/plain' } });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket upgrade', { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  },
};

const wrap = (ws) => ({
  ws,
  send(s) { try { ws.send(s); } catch (_) { /* closed */ } },
  close(code, reason) { try { ws.close(code, reason); } catch (_) { /* closed */ } },
  get meta() { return ws.deserializeAttachment() || {}; },
  set meta(v) { ws.serializeAttachment(v); },
});

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  others(ws) { return this.ctx.getWebSockets().filter((w) => w !== ws).map(wrap); }

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    roomOpen(this.others(server), wrap(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, msg) {
    if (typeof msg === 'string') roomMessage(this.others(ws), wrap(ws), msg);
  }

  webSocketClose(ws, code) {
    roomClose(this.others(ws), wrap(ws));
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch (_) { /* already closed */ }
  }

  webSocketError(ws) {
    roomClose(this.others(ws), wrap(ws));
  }
}
