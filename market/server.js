// 섬업(부제 탐라도감) 서버: 제주(섬)에서 창업을 거래하다
// DB 없이 data/*.json 파일에 저장한다 (1차 버전).
const path = require('path');
const fs = require('fs');
const express = require('express');
const { generateListing, generateHome, generateItem, answerWaste, generateThreadsPosts, aiStatus, pageImage } = require('./lib/ai');
const { fetchHackathons } = require('./lib/hackathons');
const crypto = require('crypto');
const agents = require('./lib/agents');
const { REGIONS, findRegion, jitter } = require('./lib/regions');
const jejuits = require('./lib/jejuits'); // 제주 교통정보센터 OPEN API (도로 통제·전기차 충전소·관광지·실시간 교통)
const store = require('./lib/store'); // 저장 위치(파일 / 서버리스 임시 폴더 / 오래 남기는 저장소)

// .env 파일이 있으면 읽는다 (예: GEMINI_API_KEY=..., ADMIN_PASSWORD=...). 이 파일은 GitHub에 올라가지 않는다.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}
const PORT = process.env.PORT || 4000;
const DATA = store.dir;
const file = (n) => path.join(DATA, n);
const load = (n, fallback) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return fallback; } };
const save = (n, v) => store.put(n, JSON.stringify(v, null, 1));
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max); // 줄바꿈(\n)·탭은 남긴다
const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(s);
const isDataImg = (s) => typeof s === 'string' && s.length < 2_500_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
const isImg = (s) => isDataImg(s) || (typeof s === 'string' && (/^\/uploads\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(s) || /^https:\/\/[^\s"'<>]{8,300}$/.test(s)));
// 업로드: data URL을 파일로 저장하고 /uploads/... 경로를 돌려준다
function saveUpload(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl); if (!m) return null;
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  store.putUpload(name, Buffer.from(m[2], 'base64')); return `/uploads/${name}`;
}
const TYPES = ['project', 'home', 'item'];
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const CONFIG_FILE = store.configFile;
const readConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
// 인터넷에 올린 서버(HOSTED)에서는 기본 비밀번호를 쓰지 않는다. ADMIN_PASSWORD가 없으면 관리자 로그인이 아예 막힌다.
const HOSTED = !!process.env.RENDER || !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (HOSTED ? '' : 'baton1234');
const DEFAULT_PW = !process.env.ADMIN_PASSWORD && !HOSTED;
// 아주 단순한 속도 제한: IP별 1분에 N회
const hits = new Map();
const limit = (n) => (req, res, next) => {
  const key = `${req.ip}:${req.path}`; const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60000);
  if (arr.length >= n) return res.status(429).json({ error: '너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.' });
  arr.push(now); hits.set(key, arr); next();
};
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 60000)) hits.delete(k); }, 120000);
// 방문 집계 (날짜별 페이지뷰, 개인정보 없음)
function countVisit(page) {
  const m = load('metrics.json', {}); const day = new Date().toISOString().slice(0, 10);
  m[day] = m[day] || { views: 0, pages: {} }; m[day].views++; m[day].pages[page] = (m[day].pages[page] || 0) + 1; save('metrics.json', m);
}
const adminOnly = (req, res, next) => (ADMIN_PASSWORD && req.get('x-admin-password') === ADMIN_PASSWORD ? next() : res.status(401).json({ error: '관리자 비밀번호가 틀려요.' }));

const app = express();
app.use(express.json({ limit: '25mb' })); // 사진 업로드(base64) 때문에 넉넉히
app.use(express.static(path.join(__dirname, 'public')));
app.use(store.middleware);
app.get('/uploads/:name', async (req, res) => {
  if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(req.params.name)) return res.status(404).end();
  const f = await store.getUpload(req.params.name); if (!f) return res.status(404).end();
  res.set('cache-control', 'public, max-age=31536000, immutable').sendFile(f);
});

// ---- 추천(업)·댓글: 모든 글 공통 ----
// 추천 수 = 글에 적힌 기본값 + votes.json의 실시간 증가분. 댓글은 comments.json 한 파일에 key('종류:id')로 모은다.
const hid = (x) => crypto.createHash('md5').update(String(x)).digest('hex').slice(0, 10);
const liveVotes = () => load('votes.json', {});
const voteOf = (V, kind, id, base) => Math.max(0, (Number(base) || 0) + (V[`${kind}:${id}`] || 0));
// 관리자가 추천 수를 고치면 그 숫자가 그대로 보이게: 바뀐 글은 방문자가 누른 증가분을 0으로 되돌린다
function applyAdminVotes(kind, before, after) {
  // 관리자 화면의 '추천 수'는 사이트에 보이는 숫자(기본값 + 방문자가 누른 수)다.
  // 그 숫자를 바꿔 저장하면 적은 숫자가 그대로 보이게 하고, 안 바꿨으면 그대로 둔다.
  const old = Object.fromEntries((before || []).map((x) => [x.id, Number(x.votes) || 0])); const V = liveVotes(); let changed = false;
  for (const x of after) { const k = `${kind}:${x.id}`, want = Math.max(0, Math.round(Number(x.votes) || 0));
    if (x.id in old && want === voteOf(V, kind, x.id, old[x.id])) { x.votes = old[x.id]; continue; }
    x.votes = want; if (k in V) { delete V[k]; changed = true; } }
  if (changed) save('votes.json', V);
}
const shownVotes = (kind, list) => { const V = liveVotes(); return list.map((x) => ({ ...x, votes: voteOf(V, kind, x.id, x.votes) })); };
const cKey = (c) => c.key || (c.projectId ? `project:${c.projectId}` : '');
function commentCounts() { const m = {}; for (const c of load('comments.json', [])) { if (c.hidden) continue; const k = cKey(c); m[k] = (m[k] || 0) + 1; } return m; }
const hackItems = () => (load('hackathons.json', { items: [] }).items || []).map((h) => ({ ...h, id: hid(h.url) }));
const FIND = {
  project: (id) => load('projects.json', []).find((x) => x.id === id && x.status === 'live'),
  place: (id) => load('places.json', []).find((x) => x.id === id && x.hidden !== true),
  guide: (id) => load('guides.json', []).find((x) => x.id === id && x.hidden !== true),
  program: (id) => load('programs.json', []).find((x) => x.id === id && x.hidden !== true),
  insight: (id) => load('insights.json', []).find((x) => x.id === id && x.hidden !== true),
  winner: (id) => WINNERS.find((w) => w.id === id),
  hackathon: (id) => hackItems().find((h) => h.id === id),
};
const baseVotes = (kind, item) => (kind === 'project' ? item.interest : kind === 'winner' || kind === 'hackathon' ? 0 : item.votes);
const titleOf = (item) => item.name || item.title || '';
function upVote(kind, id, undo) {
  const item = FIND[kind]?.(id); if (!item) return null;
  // 취소는 실시간 증가분 안에서만 깎는다 (글에 적힌 기본값 아래로는 내려가지 않는다)
  const V = liveVotes(); const k = `${kind}:${id}`; V[k] = undo ? Math.max(0, (V[k] || 0) - 1) : (V[k] || 0) + 1; save('votes.json', V);
  return voteOf(V, kind, id, baseVotes(kind, item));
}
const listComments = (kind, id) => load('comments.json', []).filter((c) => !c.hidden && cKey(c) === `${kind}:${id}`).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ id: cid, name, text, createdAt, parent, staff, role }) => ({ id: cid, name, text, createdAt, ...(parent ? { parent } : {}), ...(staff ? { staff: true, role: role || 'AI 직원' } : {}) }));
function addComment(kind, id, body) {
  const item = FIND[kind]?.(id); if (!item) return { error: 404 };
  const text = clean(body.text, 300); if (!text) return { error: 400 };
  const all = load('comments.json', []);
  // 대댓글: 같은 글의 맨 위 이야기에만 달 수 있다. 방문자가 쓴 글에는 직원 표시를 붙일 수 없다
  const parentId = clean(body.parent, 40); const parent = parentId ? all.find((c) => c.id === parentId && cKey(c) === `${kind}:${id}` && !c.hidden) : null;
  all.push({ id: newId(), key: `${kind}:${id}`, title: titleOf(item), name: clean(body.name, 20) || '익명', text, ...(parent ? { parent: parent.parent || parent.id } : {}), createdAt: new Date().toISOString() });
  save('comments.json', all); return { list: listComments(kind, id) };
}

// ---- 사이트 설정 (관리자 화면에서 수정) ----
app.get('/api/config', (req, res) => { const c = readConfig(); if (process.env.NAVER_MAP_CLIENT_ID) c.maps = { ...(c.maps || {}), naverClientId: process.env.NAVER_MAP_CLIENT_ID }; res.json(c); });
app.post('/api/ping', limit(60), async (req, res) => { countVisit(clean(req.body.page, 40) || '/'); if (store.SERVERLESS) { try { await autoTick(); } catch {} } res.json({ ok: true }); });
// 하루 한 번 스스로 도는 주소 (Vercel Cron). 주기가 지난 것만 돌린다
app.get('/api/cron/tick', limit(6), async (req, res) => { try { res.json({ ok: true, ran: await autoTick(true) }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/admin/metrics', adminOnly, (req, res) => {
  const m = load('metrics.json', {}); const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); days.push({ day: d, views: m[d]?.views || 0, pages: m[d]?.pages || {} }); }
  const projects = load('projects.json', []);
  res.json({ days, defaultPassword: DEFAULT_PW, totals: {
    listings: projects.filter((p) => !p.sample && p.status === 'live').length, samples: projects.filter((p) => p.sample).length,
    inquiries: load('inquiries.json', []).length, waitlist: load('waitlist.json', []).length, comments: load('comments.json', []).length,
    interest: projects.reduce((a, p) => a + (p.interest || 0), 0), views: projects.reduce((a, p) => a + (p.views || 0), 0),
  } });
});
app.post('/api/admin/login', limit(10), (req, res) => (ADMIN_PASSWORD && req.body.password === ADMIN_PASSWORD ? res.json({ ok: true, defaultPassword: DEFAULT_PW }) : res.status(401).json({ error: '비밀번호가 틀려요.' })));
app.put('/api/config', adminOnly, (req, res) => {
  const c = req.body;
  if (!c || typeof c !== 'object' || !c.site || !c.banner) return res.status(400).json({ error: '설정 형식이 맞지 않아요.' });
  store.put('config.json', JSON.stringify(c, null, 1));
  res.json({ ok: true });
});
// 관리자용: 전체 프로젝트(예시 포함) 보기 · 숨기기/보이기 · 삭제
app.get('/api/admin/projects', adminOnly, (req, res) => res.json(load('projects.json', [])));
app.post('/api/admin/projects/:id', adminOnly, (req, res) => {
  const list = load('projects.json', []);
  const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (req.body.action === 'toggle') p.status = p.status === 'live' ? 'hidden' : 'live';
  if (req.body.action === 'deal') p.deal = p.deal === 'done' ? 'open' : 'done'; // 거래 중 ↔ 거래 완료
  if (req.body.action === 'delete') list.splice(list.indexOf(p), 1);
  save('projects.json', list);
  res.json({ ok: true });
});
app.post('/api/admin/upload', adminOnly, (req, res) => { const url = saveUpload(req.body.dataUrl); url ? res.json({ url }) : res.status(400).json({ error: '이미지 형식이 맞지 않아요.' }); });
app.put('/api/admin/projects/:id', adminOnly, (req, res) => {
  const list = load('projects.json', []); const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (Array.isArray(req.body.photos)) p.photos = req.body.photos.filter(isImg).slice(0, 8);
  for (const k of ['name', 'tagline', 'description']) if (typeof req.body[k] === 'string') p[k] = clean(req.body[k], k === 'description' ? 1500 : 80);
  if (typeof req.body.area === 'string') p.area = findRegion(req.body.area)?.name || '';
  save('projects.json', list); res.json({ ok: true, photos: p.photos });
});
app.get('/api/admin/inbox', adminOnly, (req, res) => res.json({ inquiries: load('inquiries.json', []), waitlist: load('waitlist.json', []), comments: load('comments.json', []), feedback: load('feedback.json', []) }));

// ---- 프로젝트 목록 ----
app.get('/api/projects', (req, res) => {
  const showSamples = readConfig().site.showSamples !== false;
  let list = load('projects.json', []).filter((p) => p.status === 'live' && (showSamples || !p.sample));
  if (TYPES.includes(req.query.type)) list = list.filter((p) => (p.type || 'project') === req.query.type);
  res.json(list.map(pubP()));
});
app.get('/api/projects/:id', async (req, res) => {
  const find = () => load('projects.json', []).find((x) => x.id === req.params.id && x.status === 'live');
  let p = find();
  if (!p && store.durable) { await store.refresh(); p = find(); } // 다른 서버가 방금 저장한 글일 수 있다: 저장소를 다시 맞추고 한 번 더 찾는다
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(publicProject(p));
});
function publicProject(p, V = liveVotes(), C = commentCounts()) {
  const { contact, ...rest } = p; // 판매자 연락처는 공개 API에서 뺀다
  return { type: 'project', ...rest, interest: voteOf(V, 'project', p.id, p.interest), comments: C[`project:${p.id}`] || 0, deal: p.deal === 'done' ? 'done' : 'open' };
}
const pubP = () => { const V = liveVotes(), C = commentCounts(); return (p) => publicProject(p, V, C); };

// ---- AI 소개글 생성 (판매 등록 1단계) ----
app.post('/api/generate', limit(10), async (req, res) => {
  const type = TYPES.includes(req.body.type) ? req.body.type : 'project';
  const hint = clean(req.body.hint, 500);
  const photos = (Array.isArray(req.body.photos) ? req.body.photos : []).filter(isImg).slice(0, 6);
  const docs = (Array.isArray(req.body.docs) ? req.body.docs : []).filter(isImg).slice(0, 3); // 서류는 분석에만 쓰고 저장하지 않는다
  try {
    if (type === 'home') { if (!photos.length && !docs.length && !hint) return res.status(400).json({ error: '사진이나 서류, 메모 중 하나는 필요해요.' }); return res.json(await generateHome({ photos, docs, hint })); }
    if (type === 'item') { if (!photos.length && !hint) return res.status(400).json({ error: '사진 한 장은 올려 주세요.' }); return res.json(await generateItem({ photos, hint })); }
    const url = clean(req.body.url, 300);
    if (url && !isUrl(url)) return res.status(400).json({ error: '주소 형식이 맞지 않아요. https:// 로 시작해야 해요.' });
    if (!url && !photos.length) return res.status(400).json({ error: '서비스 주소나 화면 사진 중 하나는 필요해요.' });
    res.json(await generateListing({ url, hint, photos }));
  } catch (e) {
    console.error('generate failed', e.message);
    res.status(500).json({ error: '소개글을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

// AI 상태 점검 (관리자): 키가 있는지, 지금 어떤 모델이 몇 초에 답하는지. ?test=1 이면 실제로 한 번 불러 본다
app.get('/api/admin/storage', adminOnly, (req, res) => res.json(store.status()));
// 누구나 열 수 있는 상태 확인. 키의 '값'은 절대 넣지 않는다 (있는지 없는지와 이름만)
app.get('/api/status', limit(20), async (req, res) => res.json({
  storage: store.status(), storageTest: await store.selfTest(),
  ai: !!process.env.GEMINI_API_KEY, jejuIts: { cits: !!process.env.JEJU_CITS_CODE, its: !!process.env.JEJU_ITS_CODE }, adminPasswordSet: !!process.env.ADMIN_PASSWORD,
  projects: load('projects.json', []).filter((x) => x.status === 'live').length, time: new Date().toISOString(),
})); // 저장이 오래 남는 상태인지
app.get('/api/admin/ai-status', adminOnly, async (req, res) => res.json(await aiStatus(req.query.test === '1')));

// ---- 판매 등록 (2단계: 확인 후 게시) ----
app.post('/api/projects', limit(5), async (req, res) => {
  const b = req.body || {};
  const type = TYPES.includes(b.type) ? b.type : 'project';
  const url = clean(b.url, 300);
  if (type === 'project' && url && !isUrl(url)) return res.status(400).json({ error: '주소 형식이 맞지 않아요.' });
  if (type === 'project' && !url && !(Array.isArray(b.photos) && b.photos.some(isImg))) return res.status(400).json({ error: '서비스 주소나 화면 사진 중 하나는 필요해요.' });
  if (type === 'home' && !b.ownerConfirmed) return res.status(400).json({ error: '집은 집주인 본인 또는 공인중개사만 올릴 수 있어요. 확인란에 체크해 주세요.' });
  const contact = clean(b.contact, 200);
  if (!contact) return res.status(400).json({ error: '연락처(이메일 또는 오픈채팅 링크)가 필요해요.' });
  // 프로젝트인데 사진이 없으면, 서비스 주소의 대표 이미지를 가져와 넣는다
  let autoPhoto = ''; if (type === 'project' && url && !(Array.isArray(b.photos) && b.photos.some(isImg))) { try { autoPhoto = await pageImage(url); } catch {} }
  const p = {
    id: newId(),
    type,
    createdAt: new Date().toISOString(),
    status: 'live',
    photos: (Array.isArray(b.photos) && b.photos.some(isImg) ? b.photos : autoPhoto ? [autoPhoto] : []).filter(isImg).slice(0, 6).map((s) => (isDataImg(s) ? saveUpload(s) || s : s)),
    name: clean(b.name, 40) || (type === 'home' ? '이름 없는 집' : type === 'item' ? '이름 없는 물건' : '이름 없는 프로젝트'),
    tagline: clean(b.tagline, 80),
    description: clean(b.description, 1500),
    category: clean(b.category, 20) || '기타',
    tags: (Array.isArray(b.tags) ? b.tags : []).map((t) => clean(t, 20)).filter(Boolean).slice(0, 6),
    url,
    origin: clean(b.origin, 80), // 어느 해커톤에서 나왔는지
    area: findRegion(b.area || b.dong)?.name || '', // 거래 지역(읍·면·동). 지도에 동네 단위로만 표시
    stage: ['idea', 'demo', 'users', 'revenue'].includes(b.stage) ? b.stage : 'demo',
    priceMin: Math.max(0, Number(b.priceMin) || 0),
    priceMax: Math.max(0, Number(b.priceMax) || 0),
    dealType: ['sell', 'cofounder', 'open'].includes(b.dealType) ? b.dealType : 'sell',
    seller: clean(b.seller, 30) || (type === 'home' ? (b.ownerRole === 'agent' ? '공인중개사' : '집주인') : type === 'item' ? '이웃' : '익명'),
    contact,
    // 집 전용 (AI 추출 또는 직접 입력)
    home: type === 'home' ? {
      dong: clean(b.dong, 40), areaM2: Number(b.areaM2) || null, floor: clean(b.floor, 20), use: clean(b.use, 30), builtYear: Number(b.builtYear) || null,
      rooms: clean(b.rooms, 20), options: (Array.isArray(b.options) ? b.options : String(b.options || '').split(',')).map((t) => clean(t, 20)).filter(Boolean).slice(0, 8),
      deal: ['매매', '전세', '월세', '단기', '미정'].includes(b.homeDeal) ? b.homeDeal : '미정', deposit: Number(b.deposit) || 0, monthly: Number(b.monthly) || 0,
      extractedFrom: clean(b.extractedFrom, 40), ownerRole: ['owner', 'agent'].includes(b.ownerRole) ? b.ownerRole : 'owner',
    } : undefined,
    condition: type === 'item' ? clean(b.condition, 20) : undefined,
    interest: 0,
    views: 0,
    sample: false,
  };
  const list = load('projects.json', []);
  list.unshift(p);
  save('projects.json', list);
  res.json({ id: p.id });
});

// ---- 관심 등록 / 문의 ----
app.post('/api/projects/:id/interest', limit(20), (req, res) => {
  const v = upVote('project', req.params.id, req.body?.undo === true);
  v === null ? res.status(404).json({ error: 'not found' }) : res.json({ interest: v });
});
app.post('/api/projects/:id/inquiry', limit(5), (req, res) => {
  const list = load('projects.json', []);
  const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const inquiry = {
    id: newId(), projectId: p.id, projectName: p.name, createdAt: new Date().toISOString(),
    name: clean(req.body.name, 30), contact: clean(req.body.contact, 200), message: clean(req.body.message, 1000),
  };
  if (!inquiry.contact || !inquiry.message) return res.status(400).json({ error: '연락처와 내용이 필요해요.' });
  const all = load('inquiries.json', []);
  all.unshift(inquiry);
  save('inquiries.json', all);
  // 1차 버전: 판매자 연락처를 문의자에게 바로 알려준다 (직접 연결)
  res.json({ ok: true, sellerContact: p.contact });
});
app.post('/api/projects/:id/view', (req, res) => {
  const list = load('projects.json', []);
  const p = list.find((x) => x.id === req.params.id);
  if (p) { p.views = (p.views || 0) + 1; save('projects.json', list); }
  res.json({ ok: true });
});

// ---- 사고 싶어요 / 팔고 싶어요 (검증용 관심 등록) ----
app.post('/api/waitlist', limit(5), (req, res) => {
  const role = ['buy', 'sell', 'both'].includes(req.body.role) ? req.body.role : 'both';
  const contact = clean(req.body.contact, 200);
  if (!contact) return res.status(400).json({ error: '연락처가 필요해요.' });
  const all = load('waitlist.json', []);
  all.push({ role, contact, note: clean(req.body.note, 300), createdAt: new Date().toISOString() });
  save('waitlist.json', all);
  res.json({ ok: true, count: all.length });
});

// ---- 제주여행: 관광지·카페·맛집 (추천순, 피드백, 관리자 편집, 외부 API 연결 자리) ----
const PLACE_TYPES = ['spot', 'cafe', 'food'];
const publicPlace = (p) => ({ ...p, hidden: undefined });
app.get('/api/places', (req, res) => {
  const type = PLACE_TYPES.includes(req.query.type) ? req.query.type : null;
  const V = liveVotes(), C = commentCounts();
  const items = load('places.json', []).filter((p) => p.hidden !== true && (!type || p.type === type)).map((p) => ({ ...publicPlace(p), votes: voteOf(V, 'place', p.id, p.votes), comments: C[`place:${p.id}`] || 0 })).sort((a, b) => b.votes - a.votes);
  res.json({ items, updatedAt: feedState('tour').lastRun || null });
});
app.get('/api/places/:id', (req, res) => {
  const p = load('places.json', []).find((x) => x.id === req.params.id && x.hidden !== true);
  p ? res.json({ ...publicPlace(p), votes: voteOf(liveVotes(), 'place', p.id, p.votes), comments: commentCounts()[`place:${p.id}`] || 0 }) : res.status(404).json({ error: '장소가 없어요.' });
});
app.post('/api/places/:id/vote', limit(30), (req, res) => { const v = upVote('place', req.params.id); v === null ? res.status(404).json({ error: '장소가 없어요.' }) : res.json({ votes: v }); });
app.post('/api/places/:id/feedback', limit(10), (req, res) => {
  const p = load('places.json', []).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: '장소가 없어요.' });
  const text = clean(req.body.text, 500); if (!text) return res.status(400).json({ error: '내용을 적어 주세요.' });
  const all = load('feedback.json', []); all.push({ id: newId(), placeId: p.id, placeName: p.name, text, createdAt: new Date().toISOString() }); save('feedback.json', all);
  res.json({ ok: true });
});
app.get('/api/admin/places', adminOnly, (req, res) => res.json(shownVotes('place', load('places.json', []))));
app.put('/api/admin/places', adminOnly, (req, res) => {
  const list = Array.isArray(req.body) ? req.body : []; const seen = new Set();
  const cleaned = list.map((p) => ({
    id: clean(p.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || newId(), type: PLACE_TYPES.includes(p.type) ? p.type : 'spot',
    name: clean(p.name, 60), area: clean(p.area, 40), summary: clean(p.summary, 200), tip: clean(p.tip, 300), address: clean(p.address, 120),
    tags: (Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',')).map((t) => clean(t, 16)).filter(Boolean).slice(0, 8),
    image: isImg(p.image) ? p.image : '', source: { label: clean(p.source?.label, 60), url: isUrl(p.source?.url || '') ? p.source.url : '' },
    hidden: p.hidden === true, lastChecked: clean(p.lastChecked, 10), votes: Number(p.votes) || 0, externalId: clean(p.externalId, 40), lat: Number(p.lat) || null, lng: Number(p.lng) || null,
  })).filter((p) => p.name && !seen.has(p.id) && seen.add(p.id));
  applyAdminVotes('place', load('places.json', []), cleaned);
  save('places.json', cleaned); res.json({ ok: true, count: cleaned.length });
});

// ---- 지도: 거래 글(동네 단위)과 여행 장소를 한 번에. 좌표는 서버가 계산하므로 지도 API 호출·AI 토큰이 들지 않는다 ----
app.get('/api/regions', (req, res) => res.json(REGIONS.map((r) => r.name)));
app.get('/api/map', (req, res) => {
  const V = liveVotes(); const showSamples = readConfig().site.showSamples !== false; const points = [];
  for (const p of load('projects.json', [])) {
    if (p.status !== 'live' || (!showSamples && p.sample)) continue;
    const r = findRegion(p.area || p.home?.dong); if (!r) continue;
    const type = p.type || 'project';
    points.push({ kind: 'project', type, id: p.id, title: p.name, sub: p.tagline || '', area: r.name, image: (p.photos || [])[0] || '', href: `./project.html?id=${encodeURIComponent(p.id)}`, votes: voteOf(V, 'project', p.id, p.interest), done: type === 'project' && p.deal === 'done', ...jitter(p.id, r.lat, r.lng) });
  }
  for (const p of load('places.json', [])) {
    if (p.hidden === true) continue;
    const r = p.lat && p.lng ? { lat: p.lat, lng: p.lng, exact: true } : findRegion(p.area); if (!r) continue;
    points.push({ kind: 'place', type: p.type, id: p.id, title: p.name, sub: p.summary || '', area: p.area || '', image: p.image || '', href: `./place.html?id=${encodeURIComponent(p.id)}`, votes: voteOf(V, 'place', p.id, p.votes), ...(r.exact ? { lat: r.lat, lng: r.lng } : jitter(p.id, r.lat, r.lng)) });
  }
  res.json({ points, center: { lat: 33.38, lng: 126.55 } });
});

// ---- 자동 갱신 피드: 어떤 데이터가 언제 갱신됐는지 한곳에서 관리 ----
// 새 데이터 소스를 붙일 때는 여기 한 줄만 추가하면 관리자 화면·주기 실행이 따라온다.
const FEEDS = {
  hackathons: { name: '해커톤 일정 (Devpost)', every: 6 * 3600e3, run: () => refreshHackathons() },
  waste: { name: '쓰레기 배출 통계 (공공데이터포털)', every: 86400e3, run: () => refreshWasteStats() },
  tour: { name: '관광지·카페·맛집 (관광 API)', every: 86400e3, needs: 'TOUR_API_KEY', run: () => refreshTourPlaces() },
  kstartup: { name: '창업 지원사업 공고 (K-Startup, 공공데이터포털 15125364)', every: 86400e3, needs: 'DATA_GO_KR_KEY', run: () => refreshKStartup() },
  agents: { name: '본부 회의 (AI 직원)', every: 86400e3, run: () => agents.runCycle(agentCtx()) },
  shift: { name: 'AI 직원 근무 (답글·이야기·보고)', every: 6 * 3600e3, run: () => agents.runShift(agentCtx()) },
};
const feedState = (id) => (load('feeds.json', {})[id] || {});
// AI 직원이 일할 때 쓰는 것: 글 찾기와, 줄기별로 맡은 글 목록
const CATALOG = {
  project: () => load('projects.json', []).filter((p) => p.status === 'live' && (p.type || 'project') === 'project').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => ({ id: p.id, title: p.name, summary: p.tagline || p.description })),
  program: () => load('programs.json', []).filter((p) => !p.hidden).map((p) => ({ id: p.id, title: p.title, summary: p.summary })),
  insight: () => load('insights.json', []).filter((p) => !p.hidden).map((p) => ({ id: p.id, title: p.title, summary: p.summary })),
  hackathon: () => hackItems().map((h) => ({ id: h.id, title: h.title, summary: [h.dates, h.location, (h.themes || []).join(', ')].filter(Boolean).join(' · ') })),
  winner: () => WINNERS.slice(0, 30).map((w) => ({ id: w.id, title: w.name, summary: w.tagline })),
  guide: () => load('guides.json', []).filter((g) => !g.hidden).map((g) => ({ id: g.id, title: g.title, summary: g.summary })),
  place: () => load('places.json', []).filter((p) => !p.hidden).map((p) => ({ id: p.id, title: p.name, summary: p.summary })),
};
// 직원이 스스로 고치는 일 ①: 사진이 없는 프로젝트에 서비스 주소의 대표 이미지를 넣는다 (한 번에 3건까지)
async function fixMissingPhotos() {
  const list = load('projects.json', []); const fixed = [];
  for (const p of list) { if (fixed.length >= 3) break; if (p.status !== 'live' || (p.type || 'project') !== 'project' || (p.photos || []).length || !isUrl(p.url || '') || p.photoTried) continue;
    let img = ''; try { img = await pageImage(p.url); } catch {} p.photoTried = true; if (img && isImg(img)) { p.photos = [img]; fixed.push(p.name); } }
  if (list.some((p) => p.photoTried)) save('projects.json', list);
  return fixed;
}
const agentCtx = () => ({ load, save, feedState, titleOf, fixMissingPhotos, its: () => jejuits.summary(), env: { ai: !!process.env.GEMINI_API_KEY, durable: store.durable || !store.SERVERLESS }, feeds: () => Object.entries(FEEDS).map(([id, f]) => ({ id, ready: !f.needs || !!process.env[f.needs], ok: feedState(id).ok !== false })), find: (kind, id) => FIND[kind]?.(id), catalog: (kind) => (CATALOG[kind] ? CATALOG[kind]() : []) });
function markFeed(id, ok, note) { const s = load('feeds.json', {}); s[id] = { ...(s[id] || {}), lastRun: new Date().toISOString(), ok, note: note || '' }; save('feeds.json', s); }
async function runFeed(id) {
  const f = FEEDS[id]; if (!f) return;
  if (f.needs && !process.env[f.needs]) { markFeed(id, false, `${f.needs} 가 .env에 없어요`); return; }
  try { await f.run(); markFeed(id, true); } catch (e) { markFeed(id, false, e.message); }
}
// K-Startup 사업공고: 제주·전국 공고를 받아 programs.json에 '자동' 글로 합친다. 손으로 쓴 글과 숨김 표시는 건드리지 않는다.
// 공공데이터포털에서 15125364 활용신청이 승인돼야 응답이 온다.
async function refreshKStartup() {
  const key = process.env.DATA_GO_KR_KEY;
  const u = `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(key)}&page=1&perPage=200&returnType=json`;
  const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status} (활용신청 승인 여부를 확인하세요)`);
  const d = await r.json(); const rows = d.data || d.items || d.response?.body?.items || [];
  if (!Array.isArray(rows) || !rows.length) throw new Error('공고가 비어 있어요');
  const ymd = (x) => { const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(x || '')); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
  const cutoff = new Date(Date.now() - 60 * 86400e3).toISOString().slice(0, 10);
  const auto = rows.map((x) => ({
    id: `ks-${x.pbanc_sn || hid(x.biz_pbanc_nm)}`, externalId: String(x.pbanc_sn || ''), auto: true,
    title: clean(x.biz_pbanc_nm || x.intg_pbanc_biz_nm, 100), org: clean(x.pbanc_ntrp_nm || x.sprv_inst || '', 60), region: clean(x.supt_regin || '전국', 10),
    category: clean(x.supt_biz_clsfc || '지원사업', 16), summary: clean(String(x.pbanc_ctnt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), 160), target: clean(x.aply_trgt || '', 200), benefit: '',
    start: ymd(x.pbanc_rcpt_bgng_dt), end: ymd(x.pbanc_rcpt_end_dt), periodText: '', url: isUrl(x.detl_pg_url || '') ? x.detl_pg_url : 'https://www.k-startup.go.kr/',
    source: { label: 'K-Startup 공고', url: isUrl(x.detl_pg_url || '') ? x.detl_pg_url : 'https://www.k-startup.go.kr/' }, image: '', votes: 0, updatedAt: new Date().toISOString().slice(0, 10),
  })).filter((p) => p.title && /제주|전국/.test(p.region) && (!p.end || p.end >= cutoff));
  const old = load('programs.json', []); const hidden = new Set(old.filter((p) => p.hidden).map((p) => p.id));
  const manual = old.filter((p) => !p.auto);
  save('programs.json', [...manual, ...auto.map((p) => ({ ...p, hidden: hidden.has(p.id) }))]);
  console.log(`K-Startup 공고 ${auto.length}건 반영`);
}
// 관광 API: 키가 들어오면 여기서 받아와 places.json의 externalId로 맞춰 넣는다 (지금은 연결 자리만)
async function refreshTourPlaces() { throw new Error('관광 API 연결 전이에요. 키를 받으면 이 함수에 호출 주소를 넣습니다.'); }
app.get('/api/admin/feeds', adminOnly, (req, res) => res.json(Object.entries(FEEDS).map(([id, f]) => ({ id, name: f.name, everyHours: f.every / 3600e3, needs: f.needs || null, ready: !f.needs || !!process.env[f.needs], ...feedState(id) }))));
app.post('/api/admin/feeds/:id/run', adminOnly, async (req, res) => { await runFeed(req.params.id); res.json(feedState(req.params.id)); });

// ---- 본부(HQ): 큰 줄기(기둥)·부서·AI 직원·할 일·회의록. 3D 대시보드(/hq.html)가 쓴다 ----
app.get('/api/admin/hq', adminOnly, (req, res) => res.json({ ...load('hq.json', { pillars: [], agents: [], tasks: [], log: [] }), facts: agents.sense({ load, save, feedState }) }));
app.put('/api/admin/hq', adminOnly, (req, res) => {
  const b = req.body || {}; const hq = load('hq.json', { pillars: [], agents: [], tasks: [], log: [] }); const oldTasks = hq.tasks || [];
  const color = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#ff6b1a');
  if (Array.isArray(b.pillars)) hq.pillars = b.pillars.map((p) => ({ id: clean(p.id, 30).toLowerCase().replace(/[^a-z0-9-]/g, '-') || newId(), name: clean(p.name, 20), dept: clean(p.dept, 20), color: color(p.color), goal: clean(p.goal, 120), kpi: clean(p.kpi, 80) })).filter((p) => p.name).slice(0, 12);
  if (Array.isArray(b.agents)) hq.agents = b.agents.map((a) => ({ id: clean(a.id, 30).toLowerCase().replace(/[^a-z0-9-]/g, '-') || newId(), name: clean(a.name, 12), rank: ['본부장', '부서장', '팀장', '팀원'].includes(a.rank) ? a.rank : '팀원', dept: clean(a.dept, 20), pillar: clean(a.pillar, 30), persona: clean(a.persona, 120) })).filter((a) => a.name).slice(0, 40);
  if (Array.isArray(b.tasks)) hq.tasks = b.tasks.map((t) => ({ id: clean(t.id, 30) || newId(), pillar: clean(t.pillar, 30), owner: clean(t.owner, 30), title: clean(t.title, 100), why: clean(t.why, 240), status: ['proposed', 'doing', 'done'].includes(t.status) ? t.status : 'proposed', by: t.by === 'agent' ? 'agent' : 'admin', createdAt: clean(t.createdAt, 30) || new Date().toISOString() })).filter((t) => t.title).slice(0, 200);
  if (Array.isArray(b.tasks)) agents.remember(hq, oldTasks, hq.tasks);
  save('hq.json', hq); res.json({ ok: true });
});
// 본부 지식 지도: 줄기마다 실제 글을 점으로. 제목과 여는 주소만 보낸다
app.get('/api/admin/hq/graph', adminOnly, (req, res) => {
  const cfg = readConfig(); const TL = { home: '집', item: '물건', project: '프로젝트' };
  const n = (t, s, href, extra) => ({ t: String(t || '').slice(0, 60), s, href, ...extra });
  res.json({
    deal: load('projects.json', []).map((p) => n(p.name, TL[p.type || 'project'] + (p.status === 'live' ? '' : ' · 숨김'), `./project.html?id=${encodeURIComponent(p.id)}`, { dim: p.status !== 'live' || p.deal === 'done' })),
    program: load('programs.json', []).map((p) => n(p.title, agents.programStatus(p) === 'open' ? '진행' : '완료', `./post.html?kind=program&id=${encodeURIComponent(p.id)}`, { dim: p.hidden || agents.programStatus(p) !== 'open' })),
    insight: load('insights.json', []).map((p) => n(p.title, p.category, `./post.html?kind=insight&id=${encodeURIComponent(p.id)}`, { dim: !!p.hidden })),
    hackathon: [...hackItems().map((h) => n(h.title, '열린 해커톤', h.url)), ...WINNERS.map((w) => n(w.name, '수상작', w.url, { small: true }))],
    community: [...load('comments.json', []).slice(-80).map((c) => n(c.text, '이야기 · ' + (c.name || '익명'), './admin.html', { dim: !!c.hidden })), ...load('feedback.json', []).map((f) => n(f.text, '제보 · ' + f.placeName, './admin.html')), ...load('waitlist.json', []).map((w) => n(w.note || w.contact, '알림 신청', './admin.html', { small: true }))],
    life: [...load('guides.json', []).map((g) => n(g.title, '생활정보', `./guide.html?id=${encodeURIComponent(g.id)}`, { dim: !!g.hidden })), ...load('places.json', []).map((p) => n(p.name, { spot: '관광지', cafe: '카페', food: '맛집' }[p.type], `./place.html?id=${encodeURIComponent(p.id)}`, { dim: !!p.hidden }))],
    partner: [...(cfg.support || []).map((s) => n(s.org, '기관', s.href)), ...['left', 'right'].filter((k) => cfg.ads?.[k]?.title).map((k) => n(cfg.ads[k].title.replace(/\n/g, ' '), '광고 자리', cfg.ads[k].href))],
  });
});
app.post('/api/admin/hq/shift', adminOnly, async (req, res) => { try { const r = await agents.runShift(agentCtx()); markFeed('shift', true); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/admin/hq/cycle', adminOnly, async (req, res) => { try { const r = await agents.runCycle(agentCtx(), { force: true }); markFeed('agents', true); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });

// ---- 제주 생활 가이드 (글 하나 = 독립 정보 페이지, 관리자에서 편집) ----
const guideSummary = ({ id, title, summary, image, tag, lastChecked, votes }) => ({ id, title, summary, image, tag, lastChecked, votes });
app.get('/api/guides', (req, res) => { const V = liveVotes(), C = commentCounts(); res.json(load('guides.json', []).filter((g) => g.hidden !== true).map((g) => ({ ...guideSummary(g), votes: voteOf(V, 'guide', g.id, g.votes), comments: C[`guide:${g.id}`] || 0 })).sort((a, b) => b.votes - a.votes)); });
app.get('/api/guides/:id', (req, res) => {
  const g = load('guides.json', []).find((x) => x.id === req.params.id && x.hidden !== true);
  g ? res.json({ ...g, votes: voteOf(liveVotes(), 'guide', g.id, g.votes), comments: commentCounts()[`guide:${g.id}`] || 0 }) : res.status(404).json({ error: '가이드가 없어요.' });
});
app.get('/api/admin/guides', adminOnly, (req, res) => res.json(shownVotes('guide', load('guides.json', []))));
app.put('/api/admin/guides', adminOnly, (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [];
  const seen = new Set();
  const cleaned = list.map((g) => ({
    id: clean(g.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || newId(),
    title: clean(g.title, 80), summary: clean(g.summary, 160), tag: clean(g.tag, 12),
    image: isImg(g.image) ? g.image : '',
    verified: g.verified === true, hidden: g.hidden === true, lastChecked: clean(g.lastChecked, 10), votes: Number(g.votes) || 0,
    body: clean(g.body, 20000),
    sources: (Array.isArray(g.sources) ? g.sources : []).map((s) => ({ label: clean(s.label, 60), url: clean(s.url, 300) })).filter((s) => s.label && isUrl(s.url)).slice(0, 10),
  })).filter((g) => g.title && !seen.has(g.id) && seen.add(g.id));
  applyAdminVotes('guide', load('guides.json', []), cleaned);
  save('guides.json', cleaned);
  res.json({ ok: true, count: cleaned.length });
});

// ---- 제주 생활: 분리배출 ----
// 제주 교통정보센터: 요청이 오면 받아오고 10분 동안 기억한다. 승인키는 응답에 넣지 않는다.
app.get('/api/jeju/its/:kind', limit(60), async (req, res) => {
  if (!jejuits.KINDS[req.params.kind]) return res.status(404).json({ error: '없는 종류예요.' });
  res.json(jejuits.publicView(await jejuits.load(req.params.kind), req.query.all === '1' ? 3000 : req.params.kind === 'traffic' ? 30 : 80));
});
// 관리자 점검: 실제로 받은 필드 이름과 첫 줄을 본다 (형식이 바뀌었을 때 맞추기 위해)
app.get('/api/admin/its/:kind', adminOnly, async (req, res) => {
  if (!jejuits.KINDS[req.params.kind]) return res.status(404).json({ error: '없는 종류예요.' });
  const v = await jejuits.load(req.params.kind, { fresh: true });
  res.json({ ok: v.ok, status: v.status, needs: v.needs || null, error: v.error || '', count: v.count || 0, fields: v.sample?.fields || [], first: v.sample?.first || null, head: v.sample?.head || '', normalized: (v.items || []).slice(0, 3) });
});
app.post('/api/jeju/waste', limit(15), async (req, res) => {
  const question = clean(req.body.question, 200);
  if (!question) return res.status(400).json({ error: '무엇을 버리려는지 적어 주세요.' });
  const jeju = readConfig().jeju || {};
  res.json(await answerWaste({ question, rules: jeju.waste || {}, area: jeju.area || '제주시' }));
});

// ---- 제주 생활: 공공데이터 (제주특별자치도_쓰레기종류별배출현황, data.go.kr 15062868) ----
// 인증키는 .env의 DATA_GO_KR_KEY. 하루 1번만 받아오고 data/wasteStats.json에 저장해 둔다 (키는 화면에 안 나간다).
const WASTE_API = 'https://api.odcloud.kr/api/15062868/v1/uddi:c7b6745b-52bb-4c2e-8fb0-bd5a7aee2595';
function normalizeWasteRows(rows) {
  const years = []; const out = [];
  for (const r of rows) {
    const item = { city: r['행정시'], type: String(r['종류'] || '').replace('스티리폼', '스티로폼').replace(/\(.*\)$/, ''), tons: {}, recycle: {}, basis: r['데이터기준일자'] };
    for (const [k, v] of Object.entries(r)) {
      const m = /^(\d{4})년 (배출량|재활용률)/.exec(k); if (!m) continue;
      if (!years.includes(m[1])) years.push(m[1]);
      (m[2] === '배출량' ? item.tons : item.recycle)[m[1]] = Number(v) || 0;
    }
    out.push(item);
  }
  years.sort();
  return { years, rows: out, basis: rows[0]?.['데이터기준일자'] || null };
}
async function refreshWasteStats() {
  const key = process.env.DATA_GO_KR_KEY; if (!key) return;
  try {
    const r = await fetch(`${WASTE_API}?page=1&perPage=100&serviceKey=${encodeURIComponent(key)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json(); if (!Array.isArray(d.data) || !d.data.length) throw new Error('empty');
    save('wasteStats.json', { updatedAt: new Date().toISOString(), source: '제주특별자치도_쓰레기종류별배출현황 (공공데이터포털)', url: 'https://www.data.go.kr/data/15062868/openapi.do', ...normalizeWasteRows(d.data) });
    console.log(`쓰레기 통계 ${d.data.length}줄 갱신`);
  } catch (e) { console.error('waste stats refresh failed', e.message); }
}
app.get('/api/jeju/waste-data', (req, res) => {
  const d = load('wasteStats.json', null);
  if (!d) return res.status(404).json({ error: '아직 데이터가 없어요.' });
  res.json(d);
});

// ---- 통합 검색 (장터 + 수상작 + 버리는 법) ----
const { localWaste } = require('./lib/ai');
app.get('/api/search', limit(60), (req, res) => {
  const q = clean(req.query.q, 60).toLowerCase();
  if (!q) return res.json({ listings: [], winners: [], waste: null, programs: [], insights: [], guides: [], places: [] });
  const words = q.split(/\s+/).filter(Boolean);
  const hit = (txt) => words.every((w) => txt.toLowerCase().includes(w));
  const showSamples = readConfig().site.showSamples !== false;
  const listings = load('projects.json', []).filter((p) => p.status === 'live' && (showSamples || !p.sample))
    .filter((p) => hit([p.name, p.tagline, p.description, p.category, (p.tags || []).join(' '), p.home?.dong || ''].join(' '))).slice(0, 24).map(pubP());
  const V0 = liveVotes();
  const winners = WINNERS.filter((w) => hit([w.name, w.tagline, w.category, (w.themes || []).join(' ')].join(' '))).slice(0, 40).map((w) => ({ ...w, votes: voteOf(V0, 'winner', w.id, 0) }));
  const jeju = readConfig().jeju || {};
  const waste = /버리|배출|분리|쓰레기|재활용/.test(q) || words.length <= 2 ? localWaste(q, { ...(jeju.waste || {}), area: jeju.area || '제주시' }) : null;
  const V = liveVotes(), C = commentCounts();
  const posts = (kind) => load(POSTS[kind], []).filter((p) => p.hidden !== true && hit([p.title, p.org, p.category, p.summary, p.target || ''].join(' '))).slice(0, 12).map((p) => publicPost(kind, p, V, C));
  const guides = load('guides.json', []).filter((g) => g.hidden !== true && hit([g.title, g.summary, g.tag, g.body || ''].join(' '))).slice(0, 8).map((g) => ({ ...guideSummary(g), votes: voteOf(V, 'guide', g.id, g.votes) }));
  const places = load('places.json', []).filter((p) => p.hidden !== true && hit([p.name, p.area, p.summary, (p.tags || []).join(' ')].join(' '))).slice(0, 8).map((p) => ({ ...publicPlace(p), votes: voteOf(V, 'place', p.id, p.votes) }));
  res.json({ listings, winners, waste, programs: posts('program'), insights: posts('insight'), guides, places });
});

// ---- 수상작 도감 ----
const WINNERS = load('winners.json', []).map((w) => ({ ...w, id: hid(w.url) }));
app.get('/api/winners', (req, res) => { const V = liveVotes(); res.json(WINNERS.map((w) => ({ ...w, votes: voteOf(V, 'winner', w.id, 0) }))); });

// ---- 추천(업)·댓글 API (모든 종류 공통) ----
app.post('/api/up/:kind/:id', limit(40), (req, res) => {
  const v = upVote(req.params.kind, req.params.id, req.body?.undo === true);
  v === null ? res.status(404).json({ error: '글을 찾을 수 없어요.' }) : res.json({ votes: v });
});
app.get('/api/comments/:kind/:id', (req, res) => res.json(listComments(req.params.kind, req.params.id)));
app.post('/api/comments/:kind/:id', limit(6), (req, res) => {
  const r = addComment(req.params.kind, req.params.id, req.body || {});
  if (r.error === 404) return res.status(404).json({ error: '글을 찾을 수 없어요.' });
  if (r.error === 400) return res.status(400).json({ error: '내용이 필요해요.' });
  res.json(r.list);
});
// 예전 주소도 그대로 동작
app.get('/api/projects/:id/comments', (req, res) => res.json(listComments('project', req.params.id)));
app.post('/api/projects/:id/comments', limit(6), (req, res) => { const r = addComment('project', req.params.id, req.body || {}); r.error ? res.status(r.error).json({ error: r.error === 404 ? 'not found' : '내용이 필요해요.' }) : res.json(r.list); });
// 관리자: 댓글 숨기기·보이기·삭제
app.get('/api/admin/comments', adminOnly, (req, res) => res.json(load('comments.json', []).map((c) => ({ ...c, key: cKey(c) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
app.post('/api/admin/comments/:id', adminOnly, (req, res) => {
  const all = load('comments.json', []); const c = all.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  if (req.body.action === 'delete') all.splice(all.indexOf(c), 1); else c.hidden = req.body.action === 'hide';
  save('comments.json', all); res.json({ ok: true });
});

// ---- 창업정보(지원사업·자금) · 인사이트: 같은 틀의 글 묶음 ----
const POSTS = { program: 'programs.json', insight: 'insights.json' };
function publicPost(kind, p, V, C) {
  const out = { ...p, votes: voteOf(V, kind, p.id, p.votes), comments: C[`${kind}:${p.id}`] || 0 };
  if (kind === 'program') out.status = agents.programStatus(p);
  delete out.hidden; return out;
}
app.get('/api/posts/:kind', (req, res) => {
  const file = POSTS[req.params.kind]; if (!file) return res.status(404).json({ error: 'not found' });
  const V = liveVotes(), C = commentCounts();
  const items = load(file, []).filter((p) => p.hidden !== true).map((p) => publicPost(req.params.kind, p, V, C)).sort((a, b) => b.votes - a.votes);
  res.json({ items, updatedAt: req.params.kind === 'program' ? (feedState('kstartup').ok ? feedState('kstartup').lastRun : null) : null });
});
app.get('/api/posts/:kind/:id', (req, res) => {
  const file = POSTS[req.params.kind]; const p = file && load(file, []).find((x) => x.id === req.params.id && x.hidden !== true);
  p ? res.json(publicPost(req.params.kind, p, liveVotes(), commentCounts())) : res.status(404).json({ error: '글을 찾을 수 없어요.' });
});
app.get('/api/admin/posts/:kind', adminOnly, (req, res) => (POSTS[req.params.kind] ? res.json(shownVotes(req.params.kind, load(POSTS[req.params.kind], []))) : res.status(404).json({ error: 'not found' })));
app.put('/api/admin/posts/:kind', adminOnly, (req, res) => {
  const kind = req.params.kind; const file = POSTS[kind]; if (!file) return res.status(404).json({ error: 'not found' });
  const seen = new Set(); const date = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? x : '');
  const cleaned = (Array.isArray(req.body) ? req.body : []).map((p) => {
    const o = {
      id: clean(p.id, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-') || newId(), title: clean(p.title, 100), org: clean(p.org, 60), category: clean(p.category, 16), summary: clean(p.summary, 200),
      body: clean(p.body, 20000), url: isUrl(p.url || '') ? p.url : '', image: isImg(p.image) ? p.image : '', source: { label: clean(p.source?.label, 60), url: isUrl(p.source?.url || '') ? p.source.url : '' },
      votes: Number(p.votes) || 0, hidden: p.hidden === true, updatedAt: clean(p.updatedAt, 10) || new Date().toISOString().slice(0, 10), auto: p.auto === true, externalId: clean(p.externalId, 60),
    };
    if (kind === 'program') Object.assign(o, { region: clean(p.region, 10), target: clean(p.target, 200), benefit: clean(p.benefit, 300), start: date(p.start), end: date(p.end), always: p.always === true, periodText: clean(p.periodText, 60), status: ['done', 'open'].includes(p.status) ? p.status : '' });
    else Object.assign(o, { date: clean(p.date, 10), points: (Array.isArray(p.points) ? p.points : String(p.points || '').split('\n')).map((x) => clean(x, 60)).filter(Boolean).slice(0, 4) });
    return o;
  }).filter((p) => p.title && !seen.has(p.id) && seen.add(p.id));
  applyAdminVotes(kind, load(file, []), cleaned);
  save(file, cleaned); res.json({ ok: true, count: cleaned.length });
});

// ---- 해커톤 일정 ----
app.get('/api/hackathons', (req, res) => { const V = liveVotes(); const d = load('hackathons.json', { updatedAt: null, items: [] }); res.json({ updatedAt: d.updatedAt, items: hackItems().map((h) => ({ ...h, votes: voteOf(V, 'hackathon', h.id, 0) })) }); });
async function refreshHackathons() {
  try {
    const items = await fetchHackathons();
    if (items.length) { save('hackathons.json', { updatedAt: new Date().toISOString(), items }); console.log(`해커톤 ${items.length}개 갱신`); }
  } catch (e) { console.error('hackathon refresh failed', e.message); }
}

// ---- 통계 + 스레드 글 초안 (운영 자동화) ----
app.get('/api/stats', (req, res) => {
  const showSamples = readConfig().site.showSamples !== false;
  const projects = load('projects.json', []).filter((p) => p.status === 'live' && (showSamples || !p.sample));
  const waitlist = load('waitlist.json', []);
  res.json({
    homes: projects.filter((p) => p.type === 'home').length,
    items: projects.filter((p) => p.type === 'item').length,
    projects: projects.filter((p) => (p.type || 'project') === 'project').length,
    interest: projects.reduce((s, p) => s + (p.interest || 0), 0),
    inquiries: load('inquiries.json', []).length,
    waitBuy: waitlist.filter((w) => w.role !== 'sell').length,
    waitSell: waitlist.filter((w) => w.role !== 'buy').length,
    hackathons: (load('hackathons.json', { items: [] }).items || []).length,
    winners: WINNERS.length,
    programs: load('programs.json', []).filter((p) => !p.hidden && agents.programStatus(p) === 'open').length,
    insights: load('insights.json', []).filter((p) => !p.hidden).length,
    guides: load('guides.json', []).filter((p) => !p.hidden).length,
  });
});
app.get('/api/threads-drafts', async (req, res) => {
  try {
    const projects = load('projects.json', []).filter((p) => p.status === 'live');
    const hackathons = load('hackathons.json', { items: [] }).items || [];
    res.json(await generateThreadsPosts({ projects, hackathons }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 자동 갱신: 피드마다 마지막 실행이 주기보다 오래됐으면 지금 돌린다
const due = () => Object.entries(FEEDS).filter(([id, f]) => Date.now() - new Date(feedState(id).lastRun || 0).getTime() > f.every && !(f.needs && !process.env[f.needs])).map(([id]) => id);
const tick = () => { for (const id of due()) runFeed(id); };
// 서버리스에서는 타이머가 없어서, 방문이 있을 때(1분에 한 번만 확인)와 하루 한 번 예약 호출 때 돌린다.
// 시작할 때 '돌렸다'고 먼저 적어서 서버 여러 대가 같은 일을 겹쳐 하지 않게 한다.
let lastTickCheck = 0, ticking = false;
async function autoTick(force) {
  if (ticking || (!force && Date.now() - lastTickCheck < 60000)) return []; lastTickCheck = Date.now();
  const ids = due(); if (!ids.length) return [];
  ticking = true; try { for (const id of ids) markFeed(id, true, '돌리는 중'); await Promise.race([Promise.all(ids.map((id) => runFeed(id))), new Promise((r) => setTimeout(r, 50000))]); } finally { ticking = false; }
  return ids;
}
if (store.SERVERLESS) {
  // 서버리스(Vercel): 요청이 올 때만 켜지므로 서버를 직접 열지 않고 앱을 내보낸다. 자동 갱신은 관리자 화면의 '지금 갱신' 버튼으로.
  if (!ADMIN_PASSWORD) console.warn('⚠️  ADMIN_PASSWORD가 없어 관리자 로그인이 막혀 있어요. 호스팅 설정에서 환경변수를 넣어 주세요.');
} else {
  app.listen(PORT, () => {
    console.log(`섬업 실행 중: http://localhost:${PORT}`);
    if (HOSTED && !ADMIN_PASSWORD) console.warn('⚠️  ADMIN_PASSWORD가 없어 관리자 로그인이 막혀 있어요. 호스팅 설정에서 환경변수를 넣어 주세요.');
    if (DEFAULT_PW) console.warn('⚠️  관리자 비밀번호가 기본값이에요. 배포 전에 ADMIN_PASSWORD 환경변수를 설정하세요.');
    tick(); setInterval(tick, 3600e3); // 이후 1시간마다 점검
  });
}
module.exports = app;

