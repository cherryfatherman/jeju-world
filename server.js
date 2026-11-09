// 제주 월드 서버: 정적 파일 제공 + WebSocket 실시간 동기화
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const CHAT_RADIUS = 30; // 이 거리 안에 있는 사람에게만 채팅이 보임
const BOUND = 62; // 이동 가능 반경
const MAX_PHOTO = 300_000; // 사진 데이터 최대 크기(문자 수)
const COLORS = ['#ff8a65', '#ffd54f', '#81c784', '#4fc3f7', '#ba68c8', '#f06292', '#4db6ac', '#a1887f'];

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 512 * 1024 });

let nextId = 1;
const players = new Map(); // id -> { id, name, bio, color, photo, x, z, ry, ws }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const validColor = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
const validPhoto = (p) =>
  typeof p === 'string' && p.length <= MAX_PHOTO && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) ? p : null;

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg, except) {
  for (const p of players.values()) if (p.ws !== except) send(p.ws, msg);
}
// 사진 원본은 빼고, 사진이 있는지만 알려줌 (클릭할 때 따로 받음)
const publicInfo = (p) => ({ id: p.id, name: p.name, bio: p.bio, color: p.color, hasPhoto: !!p.photo, x: p.x, z: p.z, ry: p.ry });

wss.on('connection', (ws) => {
  const id = nextId++;
  const me = {
    id,
    name: `여행자${id}`,
    bio: '',
    color: COLORS[id % COLORS.length],
    photo: null,
    x: (Math.random() - 0.5) * 8,
    z: 10 + Math.random() * 4,
    ry: 0,
    ws,
  };
  players.set(id, me);

  send(ws, { t: 'init', you: publicInfo(me), players: [...players.values()].map(publicInfo) });
  broadcast({ t: 'join', player: publicInfo(me) }, ws);

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'profile') {
      me.name = cleanText(m.name, 12) || me.name;
      me.bio = cleanText(m.bio, 60);
      me.color = validColor(m.color) || me.color;
      if (m.photo === null) me.photo = null;
      else if (m.photo !== undefined) me.photo = validPhoto(m.photo) || me.photo;
      broadcast({ t: 'profile', player: publicInfo(me) });
    } else if (m.t === 'getPhoto') {
      const p = players.get(Number(m.id));
      send(ws, { t: 'photo', id: Number(m.id), photo: p?.photo || null });
    } else if (m.t === 'move') {
      if (Number.isFinite(m.x) && Number.isFinite(m.z)) {
        const d = Math.hypot(m.x, m.z);
        const k = d > BOUND ? BOUND / d : 1;
        me.x = m.x * k;
        me.z = m.z * k;
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
  const msg = JSON.stringify({ t: 'state', s: state });
  for (const p of players.values()) if (p.ws.readyState === 1) p.ws.send(msg);
}, 100);

server.listen(PORT, () => console.log(`제주 월드 실행 중: http://localhost:${PORT}`));
