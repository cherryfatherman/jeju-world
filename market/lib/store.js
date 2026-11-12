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
// 키 이름은 연결할 때 앞에 다른 말이 붙을 수 있어서(예: STORAGE_KV_REST_API_URL) 끝 이름으로 찾는다
const envBy = (...ends) => { for (const e of ends) { if (process.env[e]) return [e, process.env[e]]; } for (const e of ends) { const k = Object.keys(process.env).find((n) => n.endsWith('_' + e) && process.env[n]); if (k) return [k, process.env[k]]; } return ['', '']; };
const [KV_URL_NAME, KV_URL_RAW] = envBy('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
const [KV_TOKEN_NAME, KV_TOKEN] = envBy('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
const KV_URL = KV_URL_RAW.replace(/\/$/, '');
const durable = !!(KV_URL && KV_TOKEN);
const NAMES = ['config.json', 'projects.json', 'programs.json', 'insights.json', 'guides.json', 'places.json', 'hq.json', 'hackathons.json', 'winners.json', 'votes.json', 'comments.json', 'inquiries.json', 'waitlist.json', 'metrics.json', 'feedback.json', 'feeds.json', 'buzz.json', 'letter.json'];
const key = (name) => `seomup:f:${name}`;
async function kv(cmds) {
  const r = await fetch(`${KV_URL}/pipeline`, { method: 'POST', headers: { authorization: `Bearer ${KV_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmds), signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`저장소 응답 ${r.status}`);
  const out = await r.json(); const bad = out.find((x) => x && x.error); if (bad) throw new Error('저장소 오류: ' + String(bad.error).slice(0, 120));
  return out.map((x) => x.result);
}
const seen = {}; let lastSync = 0, pending = [], lastError = '';
// 저장소에 있는 최신 내용을 임시 폴더로 가져온다 (다른 서버가 쓴 것도 여기서 맞춰진다)
async function sync(force) {
  if (!durable || (!force && Date.now() - lastSync < 4000)) return;
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
const status = () => ({ serverless: SERVERLESS, durable, urlFrom: KV_URL_NAME, tokenFrom: KV_TOKEN_NAME,
  otherRedisNames: Object.keys(process.env).filter((n) => /REDIS|UPSTASH|(^|_)KV_/i.test(n)).sort(), // 이름만. 값은 내보내지 않는다
  lastSync: lastSync ? new Date(lastSync).toISOString() : null, error: lastError });
// 실제로 쓰고 읽어 본다
async function selfTest() {
  if (!durable) return { ok: false, why: '저장소 키를 찾지 못했어요.' };
  try { const v = String(Date.now()); await kv([['SET', 'seomup:ping', v]]); const [back] = await kv([['GET', 'seomup:ping']]); const [keys] = await kv([['MGET', ...NAMES.map(key)]]);
    return { ok: back === v, saved: NAMES.filter((n, i) => typeof (keys || [])[i] === 'string') }; } catch (e) { return { ok: false, why: e.message }; }
}

module.exports = { dir, configFile, uploads, put, putUpload, getUpload, middleware, status, selfTest, refresh: () => sync(true), SERVERLESS, durable };
