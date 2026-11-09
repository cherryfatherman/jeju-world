// 제주 월드 클라이언트: 성산일출봉 광장
import * as THREE from 'three';

const COLORS = ['#ff8a65', '#ffd54f', '#81c784', '#4fc3f7', '#ba68c8', '#f06292', '#4db6ac', '#a1887f'];
const BOUND = 62;
const SPEED = 9;
const $ = (id) => document.getElementById(id);

/* ───────────── 기본 장면 ───────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog(0xf7c08a, 90, 260);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);

scene.add(new THREE.HemisphereLight(0xffe6c7, 0x4a6b52, 1.4));
const sunLight = new THREE.DirectionalLight(0xffd2a1, 2.2);
sunLight.position.set(-40, 60, -50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 220 });
scene.add(sunLight);

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5b7fc7');
  grad.addColorStop(0.45, '#f4a76b');
  grad.addColorStop(0.75, '#ffd59a');
  grad.addColorStop(1, '#ffe9c4');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
const rand = (a, b) => a + Math.random() * (b - a);

/* ───────────── 바다 · 섬 · 광장 ───────────── */
const seaGeo = new THREE.PlaneGeometry(700, 700, 70, 70);
seaGeo.rotateX(-Math.PI / 2);
const sea = new THREE.Mesh(seaGeo, flat(0x2f8fb5, { roughness: 0.35, metalness: 0.1 }));
sea.position.y = -0.6;
scene.add(sea);
const seaBase = seaGeo.attributes.position.array.slice();

const island = new THREE.Mesh(new THREE.CircleGeometry(78, 64), flat(0x7dbb5e));
island.rotation.x = -Math.PI / 2;
island.receiveShadow = true;
scene.add(island);
const beach = new THREE.Mesh(new THREE.RingGeometry(76, 86, 64), flat(0xf0d9a8));
beach.rotation.x = -Math.PI / 2;
beach.position.y = -0.15;
scene.add(beach);

// 광장 바닥 (현무암 느낌 동심원)
for (let i = 5; i >= 1; i--) {
  const ring = new THREE.Mesh(new THREE.CircleGeometry(i * 3.6, 48), flat(i % 2 ? 0x8d8a86 : 0x9d9994));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02 + (5 - i) * 0.002;
  ring.receiveShadow = true;
  scene.add(ring);
}
// 광장에서 일출봉 쪽으로 이어지는 길
const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 60), flat(0x9d9994));
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.015, -45);
road.receiveShadow = true;
scene.add(road);

/* ───────────── 성산일출봉 ───────────── */
function buildSeongsan() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(34, 52, 30, 28, 4, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 14) { // 꼭대기 테두리는 남기고 절벽을 울퉁불퉁하게
      const s = 1 + rand(-0.08, 0.1);
      p.setX(i, p.getX(i) * s);
      p.setZ(i, p.getZ(i) * s);
      p.setY(i, y + rand(-1.5, 1.5));
    }
  }
  geo.computeVertexNormals();
  const cliff = new THREE.Mesh(geo, flat(0x6f7f4f, { side: THREE.DoubleSide }));
  cliff.castShadow = true;
  g.add(cliff);
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(33, 33, 1, 28), flat(0x9cc46a));
  crater.position.y = 12;
  g.add(crater);
  // 분화구 테두리 봉우리들
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(rand(2.5, 4), rand(3, 7), 5), flat(0x5f6e43));
    peak.position.set(Math.cos(a) * 33, 15 + rand(0, 1.5), Math.sin(a) * 33);
    peak.castShadow = true;
    g.add(peak);
  }
  g.position.set(0, 0, -120);
  return g;
}
scene.add(buildSeongsan());

// 해
const sun = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false }));
sun.position.set(-70, 55, -260);
scene.add(sun);

/* ───────────── 장식: 돌하르방 · 야자수 · 유채꽃 · 돌담 ───────────── */
function dolHareubang(x, z, ry) {
  const g = new THREE.Group();
  const stone = flat(0x5d5a57);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 2.4, 10), stone);
  body.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), stone);
  head.position.y = 2.9; head.scale.y = 1.15;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.7, 10), stone);
  hat.position.y = 3.85;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), stone);
  nose.position.set(0, 2.8, 0.82);
  const eyeM = flat(0x3d3a38);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), eyeM);
    eye.position.set(0.32 * s, 3.1, 0.72);
    g.add(eye);
  }
  g.add(body, head, hat, nose);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  scene.add(g);
}
dolHareubang(-11, 17, 0.5);
dolHareubang(11, 17, -0.5);

function palm(x, z) {
  const g = new THREE.Group();
  const h = rand(5, 8);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), flat(0x8b6b4a));
  trunk.position.y = h / 2;
  trunk.rotation.z = rand(-0.12, 0.12);
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4, 4), flat(0x3f8f45));
    leaf.position.y = h;
    leaf.rotation.z = Math.PI / 2.6;
    const holder = new THREE.Group();
    holder.add(leaf);
    holder.rotation.y = (i / 6) * Math.PI * 2;
    leaf.position.x = 1.6;
    g.add(holder);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.position.set(x, 0, z);
  scene.add(g);
}

const flowerGeo = new THREE.IcosahedronGeometry(0.28, 0);
const flowerMat = flat(0xffd83a, { emissive: 0x332900 });
const stemMat = flat(0x5a9e3c);
function canolaPatch(cx, cz, r, n) {
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, n);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 4), stemMat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    m.makeTranslation(x, 0.95, z); flowers.setMatrixAt(i, m);
    m.makeTranslation(x, 0.45, z); stems.setMatrixAt(i, m);
  }
  scene.add(flowers, stems);
}

const avoid = (x, z) => Math.hypot(x, z) < 22 || (Math.abs(x) < 6 && z < -10) || (z < -55);
for (let i = 0; i < 40; i++) {
  const a = Math.random() * Math.PI * 2, d = rand(24, 74);
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (!avoid(x, z)) palm(x, z);
}
for (const [x, z] of [[-30, 10], [32, 6], [-26, -24], [28, -28], [-12, 40], [16, 42], [-44, 30], [46, 30]]) canolaPatch(x, z, 6, 160);

// 돌담 (광장 둘레 일부)
const wallMat = flat(0x45423f);
for (let i = 0; i < 70; i++) {
  const a = (i / 70) * Math.PI * 2;
  if (Math.abs(Math.sin(a)) > 0.92) continue; // 앞뒤 입구는 비움
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.5, 0.8), 0), wallMat);
  rock.position.set(Math.cos(a) * 20.5, rand(0.3, 0.6), Math.sin(a) * 20.5);
  rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  rock.castShadow = true;
  scene.add(rock);
}

/* ───────────── 대형 광고 스크린 ───────────── */
const ADS = [
  { bg: ['#ff7043', '#ffb74d'], title: '제주 월드에 오신 걸 환영해요!', sub: '사람을 눌러 프로필을 구경해 보세요 👀' },
  { bg: ['#1e3c72', '#f7971e'], title: '🌅 성산일출봉 일출', sub: '내일 아침, 같이 오를 사람을 광장에서 찾아보세요' },
  { bg: ['#11998e', '#38ef7d'], title: '이 스크린의 주인이 되어보세요', sub: '가게 · 숙소 · 관광지 광고 문의 받습니다' },
  { bg: ['#232526', '#8e0e00'], title: '👻 오늘 밤 9시 공포체험', sub: '함께 모험을 떠날 용사 모집 중 (준비 중)' },
  { bg: ['#f857a6', '#ff5858'], title: '🍊 좌판대 오픈 예정', sub: '감귤 · 중고거래 · 부동산을 광장에서' },
];
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 1024; screenCanvas.height = 576;
const screenCtx = screenCanvas.getContext('2d');
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
let adIndex = 0;
function drawAd(i) {
  const ad = ADS[i], g = screenCtx, W = 1024, H = 576;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, ad.bg[0]); grad.addColorStop(1, ad.bg[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.12)';
  for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(rand(0, W), rand(0, H), rand(40, 160), 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 64px "Noto Sans KR", sans-serif';
  g.fillText(ad.title, W / 2, H / 2 - 40, W - 80);
  g.font = '500 34px "Noto Sans KR", sans-serif';
  g.fillText(ad.sub, W / 2, H / 2 + 50, W - 80);
  g.font = '700 22px sans-serif'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.8)';
  g.fillText(`AD ${i + 1}/${ADS.length}`, W - 24, H - 26);
  screenTex.needsUpdate = true;
}
drawAd(0);
setInterval(() => { adIndex = (adIndex + 1) % ADS.length; drawAd(adIndex); }, 5000);

const screenGroup = new THREE.Group();
const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 10, 0.6), flat(0x2b2b2e));
frame.position.y = 9;
const display = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: screenTex }));
display.position.set(0, 9, 0.31);
for (const s of [-1, 1]) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), flat(0x3a3a3e));
  post.position.set(6 * s, 2.5, 0);
  post.castShadow = true;
  screenGroup.add(post);
}
frame.castShadow = true;
screenGroup.add(frame, display);
screenGroup.position.set(0, 0, -17);
scene.add(screenGroup);

/* ───────────── 좌판대 ───────────── */
const clickables = []; // 클릭 가능한 물건들
function labelTexture(text, bg = '#ffffff', fg = '#23262b', w = 512, h = 128, font = 56) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; roundRect(g, 4, 4, w - 8, h - 8, h / 3); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${font}px "Noto Sans KR", sans-serif`;
  g.fillText(text, w / 2, h / 2 + 2, w - 30);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function stall(x, z, ry, name, color, emoji, msg) {
  const g = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 2), flat(0xb08354));
  table.position.y = 0.55;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.4, 4), flat(color));
  roof.position.y = 3.6; roof.rotation.y = Math.PI / 4;
  for (const sx of [-1.8, 1.8]) for (const sz of [-0.9, 0.9]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 5), flat(0xeeeeee));
    pole.position.set(sx, 1.5 + 0.55, sz);
    g.add(pole);
  }
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(`${emoji} ${name}`), depthWrite: false }));
  sign.scale.set(4, 1, 1);
  sign.position.y = 5;
  g.add(table, roof, sign);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.userData.click = () => toast(msg); clickables.push(m); } });
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  scene.add(g);
}
stall(-13, -4, 0.9, '감귤 좌판', 0xff9800, '🍊', '🍊 감귤 좌판은 곧 열려요! 제주 농가 직거래를 준비 중이에요.');
stall(13, -4, -0.9, '중고거래', 0x29b6f6, '🛍️', '🛍️ 중고거래 좌판 준비 중! 여행 끝나고 남은 물건을 여기서 나눠요.');
stall(14, 9, -2.2, '집 구해요', 0x8bc34a, '🏡', '🏡 한달살기 · 집 소개 좌판 준비 중! (공인중개사 · 집주인 인증 후 등록 예정)');

/* ───────────── 캐릭터 ───────────── */
const players = new Map(); // id -> { group, data, target, bubble, ... }
let myId = null;
let me = null; // 내 캐릭터 객체
const pickables = [];

function makeLabel(name, hasPhoto) {
  const tex = labelTexture(`${hasPhoto ? '📷 ' : ''}${name}`, 'rgba(20,24,32,0.72)', '#ffffff', 512, 112, 50);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }));
  s.scale.set(3.2, 0.7, 1);
  s.position.y = 3.4;
  s.renderOrder = 10;
  return s;
}

function createAvatar(p) {
  const group = new THREE.Group();
  const bodyMat = flat(p.color);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.9, 4, 10), bodyMat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), flat(0xffe0c2));
  head.position.y = 2.3;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeM);
    eye.position.set(0.18 * s, 2.35, 0.5);
    group.add(eye);
  }
  const cheekM = new THREE.MeshBasicMaterial({ color: 0xff9a9a, transparent: true, opacity: 0.7 });
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), cheekM);
    cheek.position.set(0.3 * s, 2.2, 0.49);
    group.add(cheek);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05;
  body.castShadow = head.castShadow = true;
  group.add(body, head, shadow);

  const label = makeLabel(p.name, p.hasPhoto);
  group.add(label);
  group.position.set(p.x, 0, p.z);
  group.rotation.y = p.ry;
  scene.add(group);

  for (const m of [body, head]) { m.userData.playerId = p.id; pickables.push(m); }
  return { group, body, bodyMat, label, data: p, target: new THREE.Vector3(p.x, 0, p.z), targetRy: p.ry, bubble: null, bubbleTimer: 0, walk: 0 };
}

function updateAvatarProfile(obj, p) {
  obj.data = { ...obj.data, ...p };
  obj.bodyMat.color.set(p.color);
  obj.group.remove(obj.label);
  obj.label.material.map.dispose();
  obj.label = makeLabel(p.name, p.hasPhoto);
  obj.group.add(obj.label);
}

function removeAvatar(id) {
  const obj = players.get(id);
  if (!obj) return;
  scene.remove(obj.group);
  for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.playerId === id) pickables.splice(i, 1);
  players.delete(id);
}

function showBubble(obj, text) {
  if (obj.bubble) { obj.group.remove(obj.bubble); obj.bubble.material.map.dispose(); }
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = '600 44px "Noto Sans KR", sans-serif';
  const lines = wrap(g, text, 560).slice(0, 3);
  c.width = 640; c.height = 70 + lines.length * 56;
  g.font = '600 44px "Noto Sans KR", sans-serif';
  g.fillStyle = '#ffffff'; roundRect(g, 6, 6, c.width - 12, c.height - 30, 30); g.fill();
  g.beginPath(); g.moveTo(c.width / 2 - 18, c.height - 26); g.lineTo(c.width / 2, c.height - 4); g.lineTo(c.width / 2 + 18, c.height - 26); g.fill();
  g.fillStyle = '#23262b'; g.textAlign = 'center'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, c.width / 2, 26 + i * 56));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }));
  const w = 4.2;
  s.scale.set(w, (w * c.height) / c.width, 1);
  s.position.y = 4.1 + s.scale.y / 2;
  s.renderOrder = 11;
  obj.group.add(s);
  obj.bubble = s;
  obj.bubbleTimer = 6;
}
function wrap(g, text, max) {
  const out = []; let line = '';
  for (const ch of text) {
    if (g.measureText(line + ch).width > max) { out.push(line); line = ch; } else line += ch;
  }
  if (line) out.push(line);
  return out;
}

/* ───────────── 네트워크 ───────────── */
let ws;
let joined = false;
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.onopen = () => { if (joined) sendProfile(); };
  ws.onclose = () => { setCount('연결이 끊겼어요. 다시 연결 중…'); setTimeout(connect, 2000); };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
}
const send = (m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));

function handle(m) {
  if (m.t === 'init') {
    for (const id of [...players.keys()]) removeAvatar(id);
    myId = m.you.id;
    for (const p of m.players) players.set(p.id, createAvatar(p));
    me = players.get(myId);
    if (joined) { me.group.position.set(myPos.x, 0, myPos.z); send({ t: 'move', x: myPos.x, z: myPos.z, ry: me.group.rotation.y }); }
    else myPos.set(m.you.x, 0, m.you.z);
    updateCount();
  } else if (m.t === 'join') {
    players.set(m.player.id, createAvatar(m.player));
    updateCount();
  } else if (m.t === 'leave') {
    const obj = players.get(m.id);
    if (obj && joined) sys(`${obj.data.name}님이 떠났어요.`);
    removeAvatar(m.id);
    updateCount();
  } else if (m.t === 'profile') {
    const obj = players.get(m.player.id);
    if (!obj) return;
    const isNew = obj.data.name !== m.player.name && m.player.id !== myId && joined;
    updateAvatarProfile(obj, m.player);
    if (isNew) sys(`${m.player.name}님이 광장에 들어왔어요! 👋`);
    if (openProfileId === m.player.id) renderProfile(m.player.id);
  } else if (m.t === 'photo') {
    photoCache.set(m.id, m.photo);
    if (openProfileId === m.id) renderProfile(m.id);
  } else if (m.t === 'state') {
    for (const [id, x, z, ry] of m.s) {
      if (id === myId) continue;
      const obj = players.get(id);
      if (obj) { obj.target.set(x, 0, z); obj.targetRy = ry; }
    }
  } else if (m.t === 'chat') {
    const obj = players.get(m.id);
    if (obj) showBubble(obj, m.text);
    addMsg(m.name, m.text);
  }
}

/* ───────────── 화면 UI ───────────── */
function setCount(t) { $('count').textContent = t; }
function updateCount() { setCount(`지금 광장에 ${players.size}명 있어요`); }
function addMsg(name, text, cls = '') {
  const d = document.createElement('div');
  d.className = `msg ${cls}`;
  if (name) { const n = document.createElement('span'); n.className = 'n'; n.textContent = name; d.append(n); }
  d.append(document.createTextNode(text));
  $('chatlog').append(d);
  while ($('chatlog').children.length > 30) $('chatlog').firstChild.remove();
}
const sys = (t) => addMsg('', t, 'sys');
let toastTimer;
function toast(t) {
  $('toast').textContent = t;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}

// 입장 화면
let myColor = COLORS[Math.floor(Math.random() * COLORS.length)];
let myPhoto = null; // dataURL 또는 null
let photoChanged = false;
for (const c of COLORS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.background = c;
  b.onclick = () => { myColor = c; [...$('colors').children].forEach((x) => x.classList.toggle('on', x === b)); };
  if (c === myColor) b.classList.add('on');
  $('colors').append(b);
}
try {
  const saved = JSON.parse(localStorage.getItem('jejuProfile') || '{}');
  if (saved.name) $('nameInput').value = saved.name;
  if (saved.bio) $('bioInput').value = saved.bio;
} catch {}

$('photoInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    myPhoto = await shrinkImage(file, 256);
    photoChanged = true;
    showPreview();
  } catch { toast('사진을 불러오지 못했어요. 다른 사진으로 해볼까요?'); }
  e.target.value = '';
};
$('photoRemove').onclick = () => { myPhoto = null; photoChanged = true; showPreview(); };
function showPreview() {
  const el = $('photoPreview');
  el.style.backgroundImage = myPhoto ? `url(${myPhoto})` : '';
  el.querySelector('span').style.display = myPhoto ? 'none' : '';
  $('photoRemove').hidden = !myPhoto;
}
// 가운데를 정사각형으로 잘라 작게 줄이기
function shrinkImage(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function sendProfile() {
  const msg = { t: 'profile', name: $('nameInput').value, bio: $('bioInput').value, color: myColor };
  if (photoChanged || myPhoto) msg.photo = myPhoto;
  send(msg);
  if (myId) photoCache.set(myId, myPhoto);
  photoChanged = false;
}
$('joinBtn').onclick = () => {
  if (!$('nameInput').value.trim()) { $('nameInput').focus(); toast('닉네임을 적어주세요!'); return; }
  try { localStorage.setItem('jejuProfile', JSON.stringify({ name: $('nameInput').value, bio: $('bioInput').value })); } catch {}
  const first = !joined;
  joined = true;
  sendProfile();
  $('joinModal').classList.remove('show');
  $('joinBtn').textContent = '저장하기';
  if (first) sys('성산일출봉 광장에 오신 걸 환영해요! 사람을 눌러 프로필을 구경해 보세요.');
};
$('myProfileBtn').onclick = () => $('joinModal').classList.add('show');

// 다른 사람 프로필 카드
const photoCache = new Map();
let openProfileId = null;
function openProfile(id) {
  openProfileId = id;
  const obj = players.get(id);
  if (obj?.data.hasPhoto && !photoCache.has(id)) send({ t: 'getPhoto', id });
  renderProfile(id);
  $('profileModal').classList.add('show');
}
function renderProfile(id) {
  const obj = players.get(id);
  if (!obj) { closeModal(); return; }
  const d = obj.data, el = $('pPhoto'), photo = photoCache.get(id);
  el.style.backgroundImage = photo ? `url(${photo})` : '';
  el.style.backgroundColor = photo ? '#f1f2f5' : d.color;
  el.textContent = photo ? '' : d.hasPhoto ? '…' : (d.name[0] || '?');
  $('pName').textContent = d.name + (id === myId ? ' (나)' : '');
  $('pBio').textContent = d.bio || '아직 소개가 없어요.';
  $('waveBtn').hidden = $('walkBtn').hidden = id === myId;
}
function closeModal() { $('profileModal').classList.remove('show'); openProfileId = null; }
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
$('profileModal').onclick = (e) => { if (e.target === $('profileModal')) closeModal(); };
$('waveBtn').onclick = () => {
  const obj = players.get(openProfileId);
  if (obj) say(`${obj.data.name}님 안녕하세요! 👋`);
  closeModal();
};
$('walkBtn').onclick = () => {
  const obj = players.get(openProfileId);
  if (obj) { moveTarget = obj.group.position.clone().add(new THREE.Vector3(1.6, 0, 1.6)); }
  closeModal();
};

// 채팅
function say(text) {
  if (!joined) return;
  send({ t: 'chat', text });
}
$('bar').onsubmit = (e) => {
  e.preventDefault();
  const t = $('chatInput').value.trim();
  if (t) say(t);
  $('chatInput').value = '';
  $('chatInput').blur();
};

/* ───────────── 조작 ───────────── */
const keys = new Set();
addEventListener('keydown', (e) => { if (document.activeElement.tagName !== 'INPUT') keys.add(e.key.toLowerCase()); });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let moveTarget = null;
let downAt = null;

renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
  downAt = null;
  if (!joined) return;
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hitPlayer = raycaster.intersectObjects(pickables, false)[0];
  if (hitPlayer) { openProfile(hitPlayer.object.userData.playerId); return; }
  const hitThing = raycaster.intersectObjects(clickables, false)[0];
  if (hitThing) { hitThing.object.userData.click(); return; }
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, p)) { moveTarget = p; showMarker(p); }
});

// 이동 목표 표시
const marker = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
let markerT = 0;
function showMarker(p) { marker.position.set(p.x, 0.06, p.z); marker.visible = true; markerT = 1; }

/* ───────────── 매 프레임 ───────────── */
const myPos = new THREE.Vector3(0, 0, 14);
const camOffset = new THREE.Vector3();
function fitCamera() { camOffset.set(0, innerWidth < innerHeight ? 17 : 11, innerWidth < innerHeight ? 25 : 16); }
fitCamera();
camera.position.copy(myPos).add(camOffset);
let sendTimer = 0;
let lastSent = '';
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  // 파도
  const pos = seaGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = seaBase[i * 3], z = seaBase[i * 3 + 2];
    pos.setY(i, Math.sin(x * 0.08 + t * 1.2) * 0.25 + Math.cos(z * 0.1 + t) * 0.25);
  }
  pos.needsUpdate = true;

  // 내 캐릭터 이동
  if (me && joined) {
    const dir = new THREE.Vector3();
    if (keys.has('w') || keys.has('arrowup')) dir.z -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dir.z += 1;
    if (keys.has('a') || keys.has('arrowleft')) dir.x -= 1;
    if (keys.has('d') || keys.has('arrowright')) dir.x += 1;
    if (dir.lengthSq() > 0) moveTarget = null;
    else if (moveTarget) {
      dir.subVectors(moveTarget, myPos).setY(0);
      if (dir.length() < 0.2) { moveTarget = null; dir.set(0, 0, 0); }
    }
    const moving = dir.lengthSq() > 0;
    if (moving) {
      dir.normalize();
      myPos.addScaledVector(dir, SPEED * dt);
      const d = Math.hypot(myPos.x, myPos.z);
      if (d > BOUND) myPos.multiplyScalar(BOUND / d);
      me.targetRy = Math.atan2(dir.x, dir.z);
    }
    me.group.position.copy(myPos);
    me.group.rotation.y = lerpAngle(me.group.rotation.y, me.targetRy, 12 * dt);
    animateWalk(me, moving, dt);

    sendTimer += dt;
    if (sendTimer > 0.1) {
      sendTimer = 0;
      const key = `${myPos.x.toFixed(2)},${myPos.z.toFixed(2)},${me.group.rotation.y.toFixed(2)}`;
      if (key !== lastSent) { lastSent = key; send({ t: 'move', x: myPos.x, z: myPos.z, ry: me.group.rotation.y }); }
    }
  }

  // 다른 사람들 부드럽게 따라가기
  for (const [id, obj] of players) {
    if (id !== myId) {
      const before = obj.group.position.clone();
      obj.group.position.lerp(obj.target, Math.min(1, 10 * dt));
      obj.group.rotation.y = lerpAngle(obj.group.rotation.y, obj.targetRy, 10 * dt);
      animateWalk(obj, before.distanceTo(obj.group.position) > 0.01, dt);
    }
    if (obj.bubble && (obj.bubbleTimer -= dt) <= 0) {
      obj.group.remove(obj.bubble); obj.bubble.material.map.dispose(); obj.bubble = null;
    }
  }

  // 이동 표시
  if (marker.visible) {
    markerT -= dt * 1.5;
    marker.material.opacity = Math.max(0, markerT);
    marker.scale.setScalar(1 + (1 - markerT));
    if (markerT <= 0) marker.visible = false;
  }

  // 카메라
  const camTarget = (joined ? myPos : new THREE.Vector3(Math.sin(t * 0.1) * 6, 0, 0));
  camera.position.lerp(camTarget.clone().add(camOffset), Math.min(1, 4 * dt));
  camera.lookAt(camTarget.x, camTarget.y + 2, camTarget.z - 4);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function animateWalk(obj, moving, dt) {
  obj.walk += moving ? dt * 12 : 0;
  const bob = moving ? Math.abs(Math.sin(obj.walk)) * 0.18 : obj.body.position.y - 1.05 > 0.01 ? (obj.body.position.y - 1.05) * 0.8 : 0;
  obj.body.position.y = 1.05 + bob;
  obj.body.rotation.z = moving ? Math.sin(obj.walk) * 0.06 : 0;
}
function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitCamera();
});

// 개발 확인용 (브라우저 콘솔에서 상태 보기)
window.jeju = { players, camera, get myId() { return myId; } };

connect();
tick();
