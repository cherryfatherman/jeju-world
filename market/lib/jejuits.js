// 제주특별자치도 교통정보센터(제주ITS) OPEN API.
// 승인키는 환경변수에만 둔다: JEJU_CITS_CODE(관광지·도로통제·전기차 충전소), JEJU_ITS_CODE(실시간 교통).
// 요청이 올 때 받아오고 10분 동안 기억해 둔다(서버리스에서도 돌게). AI는 쓰지 않는다.
// 응답 필드 이름을 문서로 확인하지 못해서, 이름·주소·좌표를 너그럽게 찾아낸다.
const crypto = require('crypto');
const BASE = process.env.JEJU_ITS_BASE || 'http://api.jejuits.go.kr/api/'; // JEJU_ITS_BASE는 시험할 때만 쓴다
const KINDS = {
  road: { path: 'infoRoadCloseList', key: 'JEJU_CITS_CODE', title: '도로 통제' },
  ev: { path: 'infoEvInfoList', key: 'JEJU_CITS_CODE', title: '전기차 충전소' },
  tour: { path: 'infoTourList', key: 'JEJU_CITS_CODE', title: '관광지' },
  traffic: { path: 'getFrafficInfo', key: 'JEJU_ITS_CODE', extra: '&type=L', title: '실시간 교통' },
};
const cache = {};
const TTL = 10 * 60 * 1000;

const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// 응답에서 '목록'을 찾는다: 객체로 이루어진 가장 긴 배열
function findList(d, depth = 0) {
  if (Array.isArray(d)) return d.length && typeof d[0] === 'object' ? d : [];
  if (!d || typeof d !== 'object' || depth > 4) return [];
  let best = [];
  for (const v of Object.values(d)) { const l = findList(v, depth + 1); if (l.length > best.length) best = l; }
  return best;
}
// XML로 올 때: 가장 많이 반복되는 묶음을 한 줄로 본다
function parseXml(t) {
  const count = {}; for (const m of t.matchAll(/<([A-Za-z_][\w.-]*)>/g)) count[m[1]] = (count[m[1]] || 0) + 1;
  const tags = Object.keys(count).filter((k) => count[k] > 1 && new RegExp(`<${k}>\\s*<`).test(t)).sort((a, b) => count[b] - count[a]);
  for (const tag of tags) {
    const rows = [...t.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => Object.fromEntries([...m[1].matchAll(/<([A-Za-z_][\w.-]*)>(?:<!\[CDATA\[)?([^<]*?)(?:\]\]>)?<\/\1>/g)].map((x) => [x[1], x[2].trim()])));
    if (rows.length && Object.keys(rows[0]).length) return rows;
  }
  return [];
}
const pick = (o, res) => { for (const re of res) for (const [k, v] of Object.entries(o)) if (re.test(k) && v !== null && v !== '' && typeof v !== 'object') return v; return ''; };
const num = (v) => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
function normalize(o) {
  let lat = num(pick(o, [/^(lat|latitude|la|ycrd|y_?crd|ypos|y_?coord|mapy|wgs84_?lat|y)$/i, /lat/i])), lng = num(pick(o, [/^(lng|lon|long|longitude|lo|xcrd|x_?crd|xpos|x_?coord|mapx|wgs84_?lon|x)$/i, /lon|lng/i]));
  if (lat && lng && lat > 100 && lng < 100) [lat, lng] = [lng, lat];           // 순서가 바뀌어 온 경우
  if (!(lat > 32 && lat < 35 && lng > 125 && lng < 128)) { lat = null; lng = null; } // 제주 밖 좌표는 버린다
  return {
    name: strip(pick(o, [/(tour|poi|ev|station|statn|stat|spot|road|route|link|cctv|place|fclt)_?(nm|name)$/i, /^(nm|name|title|subject|sj)$/i, /(nm|name|title)$/i])).slice(0, 80),
    addr: strip(pick(o, [/addr|address|adres|juso/i, /loc|location|section|sect|place|area|position/i])).slice(0, 120),
    desc: strip(pick(o, [/(cn|content|contents|desc|description|detail|memo|msg|message|info|reason|resn|remark|rmk|etc|intro)$/i])).slice(0, 240),
    start: strip(pick(o, [/(start|begin|bgn|st|from|strt)_?(dt|de|date|time|day|ymd)/i, /^(sdate|stdt|startdate)$/i])).slice(0, 30),
    end: strip(pick(o, [/(end|finish|ed|to|close)_?(dt|de|date|time|day|ymd)/i, /^(edate|eddt|enddate)$/i])).slice(0, 30),
    tel: strip(pick(o, [/tel|phone|telno/i])).slice(0, 30),
    image: (() => { const v = String(pick(o, [/(img|image|photo|thumb|pic)[a-z_]*(url|path|src)?$/i]) || ''); return /^https:\/\/[^\s"'<>]{8,300}$/.test(v) ? v : ''; })(),
    speed: num(pick(o, [/(spd|speed)$/i])),
    cat: (() => { // 관광지 / 카페 / 맛집: 자료에 분류 칸이 있으면 그것을, 없으면 이름으로 가른다
      const t = `${strip(pick(o, [/(cate|category|ctgry|type|gubun|kind|class|theme|tag)[a-z_]*(nm|name)?$/i]))} ${strip(pick(o, [/(tour|poi|spot|place|fclt)_?(nm|name)$/i, /^(nm|name|title)$/i, /(nm|name|title)$/i]))}`;
      if (/카페|커피|coffee|cafe|베이커리|디저트|찻집|다방|로스터|브런치/i.test(t)) return 'cafe';
      if (/음식|식당|맛집|국수|횟집|흑돼지|갈비|해장국|밥상|반점|치킨|버거|김밥|고깃집|회센터|회센타|식육|국밥|해물|갈치|고기|분식|뷔페|레스토랑|restaurant|가든$|식탁|한정식|돈가스|파스타|피자|초밥|스시|라멘|짬뽕|보말|몸국|칼국수|막국수|순대|족발|곱창|삼겹|불고기|떡볶이|포차|주점|횟|수산$/i.test(t)) return 'food';
      return 'spot'; })(),
    lat, lng,
  };
}

async function load(kind, { fresh = false } = {}) {
  const K = KINDS[kind]; if (!K) return { ok: false, error: '없는 종류예요.', items: [] };
  const code = process.env[K.key];
  if (!code) return { ok: false, needs: K.key, error: '승인키가 서버에 없어요.', items: [] };
  const c = cache[kind]; if (!fresh && c && Date.now() - c.at < TTL) return c.value;
  let value;
  try {
    const r = await fetch(`${BASE}${K.path}?code=${encodeURIComponent(code)}${K.extra || ''}`, { signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    let raw = []; try { raw = findList(JSON.parse(text)); } catch { raw = parseXml(text); }
    const items = raw.map(normalize).filter((x) => x.name || x.addr || x.desc).map((x) => ({ id: crypto.createHash('md5').update(`${x.name}|${x.addr}`).digest('hex').slice(0, 12), ...x })); /* id: 추천을 붙이기 위한 고정 번호 */
    let chargers = 0;
    if (kind === 'ev') { /* 충전기 한 대가 한 줄로 오므로, 같은 충전소(이름+주소)는 한 줄로 묶고 충전기 수를 센다 */
      chargers = items.length; const by = new Map(); for (const x of items) { const k = `${x.name}|${x.addr}`; const g = by.get(k); if (g) g.n++; else by.set(k, { ...x, n: 1 }); }
      items.length = 0; for (const g of by.values()) items.push({ ...g, desc: [`충전기 ${g.n}대`, g.desc].filter(Boolean).join(' · ') }); }
    const emptyOk = kind === 'road' && r.ok && raw.length === 0 && text.length < 2000 && !/error|fail|invalid|인증|오류/i.test(text); /* 통제가 없는 날 */
    value = { chargers, ok: (r.ok && raw.length > 0) || emptyOk, status: r.status, title: K.title, updatedAt: new Date().toISOString(), source: '제주특별자치도 교통정보센터', count: items.length, items,
      sample: { fields: raw[0] ? Object.keys(raw[0]) : [], first: raw[0] || null, head: raw.length ? '' : text.slice(0, 400) } };
    if (!value.ok) value.error = raw.length ? '' : '받은 내용에서 목록을 찾지 못했어요.'; if (emptyOk) value.sample.head = text.slice(0, 400);
  } catch (e) { value = { ok: false, title: K.title, error: /abort|timeout/i.test(e.message) ? '응답이 늦어요.' : '연결하지 못했어요.', items: [], sample: { fields: [], first: null, head: String(e.message).slice(0, 200) } }; }
  cache[kind] = { at: Date.now(), value }; return value;
}
// 방문자에게 보내는 모양 (원본 표본과 키는 빼고, 개수를 줄여서)
const summary = async () => { const out = {}; for (const k of ['road', 'ev', 'tour', 'traffic']) { try { const v = await load(k); out[k] = v.ok ? v.count : null; } catch { out[k] = null; } } return out; };
const publicView = (v, limit = 60) => ({ chargers: v.chargers || 0, ok: v.ok, title: v.title, updatedAt: v.updatedAt, source: v.source, count: v.count || 0, items: (v.items || []).slice(0, limit) });

const peek = (kind) => (cache[kind] ? cache[kind].value.items || [] : []); // 이미 받아 둔 목록 (기다리지 않고)
module.exports = { KINDS, load, publicView, summary, peek };
