// 제주 월드 서버: 정적 파일 제공 + WebSocket 실시간 동기화
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const CHAT_RADIUS = 30; // 이 거리 안에 있는 사람에게만 채팅이 보임
const BOUND = 70; // 맵 이동 범위
const COLORS = [0xff8a65, 0xffd54f, 0x81c784, 0x4fc3f7, 0xba68c8, 0xf06292, 0x90a4ae, 0xa1887f];

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let nextId = 1;
const players = new Map(); // id -> { id, name, color, x, z, ry, ws }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg, except) {
  for (const p of players.values()) if (p.ws !== except) send(p.ws, msg);
}
const publicInfo = (p) => ({ id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, ry: p.ry });

wss.on('connection', (ws) => {
  const id = nextId++;
  const me = {
    id,
    name: `제주여행자${id}`,
    color: COLORS[id % COLORS.length],
    x: (Math.random() - 0.5) * 10,
    z: 8 + Math.random() * 4,
    ry: 0,
    ws,
  };
  players.set(id, me);

  send(ws, { t: 'init', you: publicInfo(me), players: [...players.values()].map(publicInfo) });
  broadcast({ t: 'join', player: publicInfo(me) }, ws);

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'name') {
      me.name = cleanText(m.name, 12) || me.name;
      broadcast({ t: 'rename', id, name: me.name });
      send(ws, { t: 'rename', id, name: me.name });
    } else if (m.t === 'move') {
      if (Number.isFinite(m.x) && Number.isFinite(m.z)) {
        me.x = clamp(m.x, -BOUND, BOUND);
        me.z = clamp(m.z, -BOUND, BOUND);
        me.ry = Number.isFinite(m.ry) ? m.ry : me.ry;
      }
    } else if (m.t === 'chat') {
      const text = cleanText(m.text, 120);
      if (!text) return;
      const msg = { t: 'chat', id, name: me.name, text };
      for (const p of players.values()) {
        if (Math.hypot(p.x - me.x, p.z - me.z) <= CHAT_RADIUS) send(p.ws, msg);
      }
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
  });
});

// 10Hz로 모든 위치를 한 번에 전송
setInterval(() => {
  if (!players.size) return;
  const state = [...players.values()].map((p) => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2)]);
  for (const p of players.values()) send(p.ws, { t: 'state', s: state });
}, 100);

server.listen(PORT, () => console.log(`제주 월드 실행 중: http://localhost:${PORT}`));
