// 저장 위치를 정한다.
// 1) 내 컴퓨터·일반 서버: market/data 폴더와 config.json 파일 (예전 그대로).
// 2) Vercel 같은 서버리스: 프로그램 폴더는 읽기 전용이라, 임시 폴더(/tmp)에 원본을 복사해 놓고 거기에 쓴다.
//    임시 폴더는 서버가 새로 뜨면 비워지므로, 방문자가 남긴 추천·이야기·새 글은 오래 남지 않는다.
// 3) 여기에 저장소(Upstash Redis, Vercel의 Storage에서 무료로 추가)를 붙이면 2)의 내용이 계속 남는다.
//    환경변수 KV_REST_API_URL / KV_REST_API_TOKEN 이 있으면 자동으로 켜진다. 키는 코드에 적지 않는다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVERLESS = !!process.env.VERCEL;
const dir = SERVERLESS ? (process.env.SEOMUP_TMP || '/tmp/seomup-data') : path.join(ROOT, 'data');
const configFile = SERVERLESS ? path.join(dir, 'config.json') : path.join(ROOT, 'config.json');
const uploads = path.join(dir, 'uploads');
const fileOf = (name) => (name === 'config.json' ? configFile : path.join(dir, name));

if (SERVERLESS) {
  // 원본을 하나씩 직접 불러야 배포 묶음에 함께 실린다.
  const SEED = {
    'config.json': require('../config.json'),
    'guides.json': require('../data/guides.json'),
    'hackathons.json': require('../data/hackathons.json'),
    'hackathons.local.json': require('../data/hackathons.local.json'),
    'hq.json': require('../data/hq.json'),
    'insights.json': require('../data/insights.json'),
    'places.json': require('../data/places.json'),
    'programs.json': require('../data/programs.json'),
    'projects.json': require('../data/projects.json'),
    'wasteStats.json': require('../data/wasteStats.json'),
    'winners.json': require('../data/winners.json'),
  };
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, value] of Object.entries(SEED)) if (!fs.existsSync(fileOf(name))) fs.writeFileSync(fileOf(name), JSON.stringify(value));
}
fs.mkdirSync(uploads, { recursive: true });

// ── 오래 남기는 저장소 (선택) ──
const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const durable = !!(KV_URL && KV_TOKEN);
const NAMES = ['config.json', 'projects.json', 'programs.json', 'insights.json', 'guides.json', 'places.json', 'hq.json', 'hackathons.json', 'winners.json', 'votes.json', 'comments.json', 'inquiries.json', 'waitlist.json', 'metrics.json', 'feedback.json', 'feeds.json'];
const key = (name) => `seomup:f:${name}`;
async function kv(cmds) {
  const r = await fetch(`${KV_URL}/pipeline`, { method: 'POST', headers: { authorization: `Bearer ${KV_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmds), signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`저장소 응답 ${r.status}`);
  return (await r.json()).map((x) => x.result);
}
const seen = {}; let lastSync = 0, pending = [], lastError = '';
// 저장소에 있는 최신 내용을 임시 폴더로 가져온다 (다른 서버가 쓴 것도 여기서 맞춰진다)
async function sync(force) {
  if (!durable || (!force && Date.now() - lastSync < 10000)) return;
  try {
    const vals = await kv([['MGET', ...NAMES.map(key)]]).then((r) => r[0] || []);
    NAMES.forEach((name, i) => { const v = vals[i]; if (typeof v === 'string' && v !== seen[name]) { fs.writeFileSync(fileOf(name), v); seen[name] = v; } });
    lastSync = Date.now(); lastError = '';
  } catch (e) { lastError = e.message; }
}
// 글 파일 저장: 파일에 쓰고, 저장소가 있으면 거기에도
function put(name, text) {
  fs.writeFileSync(fileOf(name), text);
  if (durable && NAMES.includes(name)) { seen[name] = text; pending.push(kv([['SET', key(name), text]]).catch((e) => { lastError = e.message; })); }
}
function putUpload(name, buf) {
  fs.writeFileSync(path.join(uploads, name), buf);
  if (durable) pending.push(kv([['SET', `seomup:u:${name}`, buf.toString('base64')]]).catch((e) => { lastError = e.message; }));
}
async function getUpload(name) {
  const f = path.join(uploads, name);
  if (fs.existsSync(f)) return f;
  if (!durable) return null;
  try { const [v] = await kv([['GET', `seomup:u:${name}`]]); if (typeof v !== 'string') return null; fs.writeFileSync(f, Buffer.from(v, 'base64')); return f; } catch (e) { lastError = e.message; return null; }
}
const flush = async () => { const p = pending; pending = []; await Promise.all(p); };
// 요청마다: 시작할 때 최신 내용을 맞추고, 답을 보내기 전에 저장이 끝나기를 기다린다
function middleware(req, res, next) {
  if (!durable) return next();
  const json = res.json.bind(res);
  res.json = (body) => { flush().finally(() => json(body)); return res; };
  sync(req.method !== 'GET').then(() => next(), () => next());
}
const status = () => ({ serverless: SERVERLESS, durable, lastSync: lastSync ? new Date(lastSync).toISOString() : null, error: lastError });

module.exports = { dir, configFile, uploads, put, putUpload, getUpload, middleware, status, SERVERLESS, durable };
