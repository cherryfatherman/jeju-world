// 바톤(Baton) 서버: AI로 만든 서비스·해커톤 프로젝트 거래 장터
// DB 없이 data/*.json 파일에 저장한다 (1차 버전).
const path = require('path');
const fs = require('fs');
const express = require('express');
const { generateListing, generateThreadsPosts } = require('./lib/ai');
const { fetchHackathons } = require('./lib/hackathons');

const PORT = process.env.PORT || 4000;
const DATA = path.join(__dirname, 'data');
const file = (n) => path.join(DATA, n);
const load = (n, fallback) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return fallback; } };
const save = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v, null, 1));
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max); // 줄바꿈(\n)·탭은 남긴다
const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(s);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- 프로젝트 목록 ----
app.get('/api/projects', (req, res) => {
  const list = load('projects.json', []).filter((p) => p.status === 'live');
  res.json(list.map(publicProject));
});
app.get('/api/projects/:id', (req, res) => {
  const p = load('projects.json', []).find((x) => x.id === req.params.id && x.status === 'live');
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(publicProject(p));
});
function publicProject(p) {
  const { contact, ...rest } = p; // 판매자 연락처는 공개 API에서 뺀다
  return rest;
}

// ---- AI 소개글 생성 (판매 등록 1단계) ----
app.post('/api/generate', async (req, res) => {
  const url = clean(req.body.url, 300);
  const hint = clean(req.body.hint, 500);
  if (!isUrl(url)) return res.status(400).json({ error: '주소 형식이 맞지 않아요. https:// 로 시작해야 해요.' });
  try {
    const result = await generateListing({ url, hint });
    res.json(result);
  } catch (e) {
    console.error('generate failed', e.message);
    res.status(500).json({ error: '소개글을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

// ---- 판매 등록 (2단계: 확인 후 게시) ----
app.post('/api/projects', (req, res) => {
  const b = req.body || {};
  const url = clean(b.url, 300);
  if (!isUrl(url)) return res.status(400).json({ error: '주소가 필요해요.' });
  const contact = clean(b.contact, 200);
  if (!contact) return res.status(400).json({ error: '연락처(이메일 또는 오픈채팅 링크)가 필요해요.' });
  const p = {
    id: newId(),
    createdAt: new Date().toISOString(),
    status: 'live',
    name: clean(b.name, 40) || '이름 없는 프로젝트',
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
    seller: clean(b.seller, 30) || '익명',
    contact,
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
app.post('/api/projects/:id/interest', (req, res) => {
  const list = load('projects.json', []);
  const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  p.interest = (p.interest || 0) + 1;
  save('projects.json', list);
  res.json({ interest: p.interest });
});
app.post('/api/projects/:id/inquiry', (req, res) => {
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
app.post('/api/waitlist', (req, res) => {
  const role = ['buy', 'sell', 'both'].includes(req.body.role) ? req.body.role : 'both';
  const contact = clean(req.body.contact, 200);
  if (!contact) return res.status(400).json({ error: '연락처가 필요해요.' });
  const all = load('waitlist.json', []);
  all.push({ role, contact, note: clean(req.body.note, 300), createdAt: new Date().toISOString() });
  save('waitlist.json', all);
  res.json({ ok: true, count: all.length });
});

// ---- 수상작 도감 ----
const WINNERS = load('winners.json', []);
app.get('/api/winners', (req, res) => res.json(WINNERS));

// ---- 한 줄 추천(댓글) ----
app.get('/api/projects/:id/comments', (req, res) => {
  res.json(load('comments.json', []).filter((c) => c.projectId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post('/api/projects/:id/comments', (req, res) => {
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
  const projects = load('projects.json', []).filter((p) => p.status === 'live');
  const waitlist = load('waitlist.json', []);
  res.json({
    projects: projects.length,
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
  refreshHackathons();
  setInterval(refreshHackathons, 6 * 60 * 60 * 1000); // 6시간마다 자동 갱신
});
