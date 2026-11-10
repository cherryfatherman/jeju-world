// 바톤(Baton) 서버: AI로 만든 서비스·해커톤 프로젝트 거래 장터
// DB 없이 data/*.json 파일에 저장한다 (1차 버전).
const path = require('path');
const fs = require('fs');
const express = require('express');
const { generateListing, generateHome, generateItem, answerWaste, generateThreadsPosts } = require('./lib/ai');
const { fetchHackathons } = require('./lib/hackathons');

// .env 파일이 있으면 읽는다 (예: GEMINI_API_KEY=..., ADMIN_PASSWORD=...). 이 파일은 GitHub에 올라가지 않는다.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}
const PORT = process.env.PORT || 4000;
const DATA = path.join(__dirname, 'data');
const file = (n) => path.join(DATA, n);
const load = (n, fallback) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return fallback; } };
const save = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v, null, 1));
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max); // 줄바꿈(\n)·탭은 남긴다
const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(s);
const isDataImg = (s) => typeof s === 'string' && s.length < 2_500_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
const isImg = (s) => isDataImg(s) || (typeof s === 'string' && (/^\/uploads\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(s) || /^https:\/\/[^\s"'<>]{8,300}$/.test(s)));
// 업로드: data URL을 파일로 저장하고 /uploads/... 경로를 돌려준다
function saveUpload(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl); if (!m) return null;
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[2], 'base64')); return `/uploads/${name}`;
}
const TYPES = ['project', 'home', 'item'];
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const CONFIG_FILE = path.join(__dirname, 'config.json');
const readConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'baton1234'; // 배포할 때 환경변수로 꼭 바꾸세요
const DEFAULT_PW = !process.env.ADMIN_PASSWORD;
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
const adminOnly = (req, res, next) => (req.get('x-admin-password') === ADMIN_PASSWORD ? next() : res.status(401).json({ error: '관리자 비밀번호가 틀려요.' }));

const app = express();
app.use(express.json({ limit: '25mb' })); // 사진 업로드(base64) 때문에 넉넉히
app.use(express.static(path.join(__dirname, 'public')));
const UPLOADS = path.join(DATA, 'uploads'); fs.mkdirSync(UPLOADS, { recursive: true });
app.use('/uploads', express.static(UPLOADS));

// ---- 사이트 설정 (관리자 화면에서 수정) ----
app.get('/api/config', (req, res) => res.json(readConfig()));
app.post('/api/ping', limit(60), (req, res) => { countVisit(clean(req.body.page, 40) || '/'); res.json({ ok: true }); });
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
app.post('/api/admin/login', limit(10), (req, res) => (req.body.password === ADMIN_PASSWORD ? res.json({ ok: true, defaultPassword: DEFAULT_PW }) : res.status(401).json({ error: '비밀번호가 틀려요.' })));
app.put('/api/config', adminOnly, (req, res) => {
  const c = req.body;
  if (!c || typeof c !== 'object' || !c.site || !c.banner) return res.status(400).json({ error: '설정 형식이 맞지 않아요.' });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 1));
  res.json({ ok: true });
});
// 관리자용: 전체 프로젝트(예시 포함) 보기 · 숨기기/보이기 · 삭제
app.get('/api/admin/projects', adminOnly, (req, res) => res.json(load('projects.json', [])));
app.post('/api/admin/projects/:id', adminOnly, (req, res) => {
  const list = load('projects.json', []);
  const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (req.body.action === 'toggle') p.status = p.status === 'live' ? 'hidden' : 'live';
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
  save('projects.json', list); res.json({ ok: true, photos: p.photos });
});
app.get('/api/admin/inbox', adminOnly, (req, res) => res.json({ inquiries: load('inquiries.json', []), waitlist: load('waitlist.json', []), comments: load('comments.json', []) }));

// ---- 프로젝트 목록 ----
app.get('/api/projects', (req, res) => {
  const showSamples = readConfig().site.showSamples !== false;
  let list = load('projects.json', []).filter((p) => p.status === 'live' && (showSamples || !p.sample));
  if (TYPES.includes(req.query.type)) list = list.filter((p) => (p.type || 'project') === req.query.type);
  res.json(list.map(publicProject));
});
app.get('/api/projects/:id', (req, res) => {
  const p = load('projects.json', []).find((x) => x.id === req.params.id && x.status === 'live');
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(publicProject(p));
});
function publicProject(p) {
  const { contact, ...rest } = p; // 판매자 연락처는 공개 API에서 뺀다
  return { type: 'project', ...rest };
}

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
    if (!isUrl(url)) return res.status(400).json({ error: '주소 형식이 맞지 않아요. https:// 로 시작해야 해요.' });
    res.json(await generateListing({ url, hint }));
  } catch (e) {
    console.error('generate failed', e.message);
    res.status(500).json({ error: '소개글을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

// ---- 판매 등록 (2단계: 확인 후 게시) ----
app.post('/api/projects', limit(5), (req, res) => {
  const b = req.body || {};
  const type = TYPES.includes(b.type) ? b.type : 'project';
  const url = clean(b.url, 300);
  if (type === 'project' && !isUrl(url)) return res.status(400).json({ error: '주소가 필요해요.' });
  if (type === 'home' && !b.ownerConfirmed) return res.status(400).json({ error: '집은 집주인 본인 또는 공인중개사만 올릴 수 있어요. 확인란에 체크해 주세요.' });
  const contact = clean(b.contact, 200);
  if (!contact) return res.status(400).json({ error: '연락처(이메일 또는 오픈채팅 링크)가 필요해요.' });
  const p = {
    id: newId(),
    type,
    createdAt: new Date().toISOString(),
    status: 'live',
    photos: (Array.isArray(b.photos) ? b.photos : []).filter(isImg).slice(0, 6).map((s) => (isDataImg(s) ? saveUpload(s) || s : s)),
    name: clean(b.name, 40) || (type === 'home' ? '이름 없는 집' : type === 'item' ? '이름 없는 물건' : '이름 없는 프로젝트'),
    tagline: clean(b.tagline, 80),
    description: clean(b.description, 1500),
    category: clean(b.category, 20) || '기타',
    tags: (Array.isArray(b.tags) ? b.tags : []).map((t) => clean(t, 20)).filter(Boolean).slice(0, 6),
    url,
    origin: clean(b.origin, 80), // 어느 해커톤에서 나왔는지
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
  const list = load('projects.json', []);
  const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  p.interest = (p.interest || 0) + 1;
  save('projects.json', list);
  res.json({ interest: p.interest });
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

// ---- 제주 생활: 분리배출 ----
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
  if (!q) return res.json({ listings: [], winners: [], waste: null });
  const words = q.split(/\s+/).filter(Boolean);
  const hit = (txt) => words.every((w) => txt.toLowerCase().includes(w));
  const showSamples = readConfig().site.showSamples !== false;
  const listings = load('projects.json', []).filter((p) => p.status === 'live' && (showSamples || !p.sample))
    .filter((p) => hit([p.name, p.tagline, p.description, p.category, (p.tags || []).join(' '), p.home?.dong || ''].join(' '))).slice(0, 24).map(publicProject);
  const winners = load('winners.json', []).filter((w) => hit([w.name, w.tagline, w.category, (w.themes || []).join(' ')].join(' '))).slice(0, 40);
  const jeju = readConfig().jeju || {};
  const waste = /버리|배출|분리|쓰레기|재활용/.test(q) || words.length <= 2 ? localWaste(q, { ...(jeju.waste || {}), area: jeju.area || '제주시' }) : null;
  res.json({ listings, winners, waste });
});

// ---- 수상작 도감 ----
const WINNERS = load('winners.json', []);
app.get('/api/winners', (req, res) => res.json(WINNERS));

// ---- 한 줄 추천(댓글) ----
app.get('/api/projects/:id/comments', (req, res) => {
  res.json(load('comments.json', []).filter((c) => c.projectId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post('/api/projects/:id/comments', limit(5), (req, res) => {
  const list = load('projects.json', []);
  const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const text = clean(req.body.text, 140);
  if (!text) return res.status(400).json({ error: '내용이 필요해요.' });
  const all = load('comments.json', []);
  all.push({ id: newId(), projectId: p.id, name: clean(req.body.name, 20) || '익명', text, createdAt: new Date().toISOString() });
  save('comments.json', all);
  p.comments = all.filter((c) => c.projectId === p.id).length;
  save('projects.json', list);
  res.json(all.filter((c) => c.projectId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

// ---- 해커톤 일정 ----
app.get('/api/hackathons', (req, res) => res.json(load('hackathons.json', { updatedAt: null, items: [] })));
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
  });
});
app.get('/api/threads-drafts', async (req, res) => {
  try {
    const projects = load('projects.json', []).filter((p) => p.status === 'live');
    const hackathons = load('hackathons.json', { items: [] }).items || [];
    res.json(await generateThreadsPosts({ projects, hackathons }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`바톤 실행 중: http://localhost:${PORT}`);
  if (DEFAULT_PW) console.warn('⚠️  관리자 비밀번호가 기본값이에요. 배포 전에 ADMIN_PASSWORD 환경변수를 설정하세요.');
  refreshHackathons();
  // 공공데이터: 캐시가 하루 넘게 지났을 때만 다시 받아온다
  const ws = load('wasteStats.json', null);
  if (!ws || Date.now() - new Date(ws.updatedAt).getTime() > 86400e3) refreshWasteStats();
  setInterval(refreshWasteStats, 86400e3);
  setInterval(refreshHackathons, 6 * 60 * 60 * 1000); // 6시간마다 자동 갱신
});
