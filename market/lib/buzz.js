// 섬업 점수(1~1000): 사이트에 아직 방문자가 적을 때, 이미 있는 정보로 장소의 순서를 정한다.
// ① 네이버 블로그에 올라온 글 수(네이버 검색 API)를 쟀다면 그 수로 상대 점수를 준다 (가장 많은 곳이 1000점, 로그 눈금).
// ② 아직 재지 못한 곳은 자료가 얼마나 갖춰졌는지(사진·좌표·전화·설명)로 60~300점을 준다.
// 키는 환경변수에만 둔다: NAVER_SEARCH_ID, NAVER_SEARCH_SECRET (developers.naver.com 의 '검색' API). 없으면 ②만 쓴다. AI는 쓰지 않는다.
const BASE = process.env.NAVER_SEARCH_BASE || 'https://openapi.naver.com'; // NAVER_SEARCH_BASE는 시험할 때만 쓴다
const norm = (n) => String(n || '').replace(/\s+/g, '');
const ready = () => !!(process.env.NAVER_SEARCH_ID && process.env.NAVER_SEARCH_SECRET);

async function count(name) {
  const r = await fetch(`${BASE}/v1/search/blog.json?display=1&query=${encodeURIComponent(`제주 "${name}"`)}`, { headers: { 'X-Naver-Client-Id': process.env.NAVER_SEARCH_ID, 'X-Naver-Client-Secret': process.env.NAVER_SEARCH_SECRET }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('네이버 검색 ' + r.status);
  const d = await r.json(); const n = Number(d.total); if (!Number.isFinite(n)) throw new Error('글 수를 읽지 못했어요.'); return n;
}
// 아직 재지 않은 곳부터(없으면 가장 오래된 것부터) 한 번에 limit곳씩 잰다. 5곳씩 나란히
async function measure(names, book, limit = 40) {
  if (!ready()) return { done: 0, note: '네이버 검색 키가 없어요.' };
  const uniq = [...new Set(names.map(norm).filter((k) => k.length >= 2))]; const raw = {}; for (const n of names) raw[norm(n)] = raw[norm(n)] || n;
  const todo = uniq.filter((k) => !book[k]).concat(uniq.filter((k) => book[k]).sort((a, b) => String(book[a].at).localeCompare(String(book[b].at)))).slice(0, limit);
  let done = 0, err = '';
  for (let i = 0; i < todo.length; i += 5) { const got = await Promise.allSettled(todo.slice(i, i + 5).map((k) => count(raw[k]).then((n) => { book[k] = { n, at: new Date().toISOString().slice(0, 10) }; done++; })));
    const bad = got.find((g) => g.status === 'rejected'); if (bad) { err = bad.reason.message; if (!done) break; } }
  return { done, left: uniq.filter((k) => !book[k]).length, note: err };
}
// 목록에 score(1~1000)와 buzz(잰 글 수, 없으면 null)를 붙인다
function attach(items, book) {
  let max = 0; for (const k in book) max = Math.max(max, Math.log1p(book[k].n || 0));
  return items.map((x) => { const b = book[norm(x.name)];
    if (b && max > 0) return { ...x, score: Math.max(1, Math.min(1000, Math.round(1 + 999 * Math.log1p(b.n) / max))), buzz: b.n };
    /* 재지 않은 곳: 자료가 갖춰진 정도로 100~1000점. 사진 300, 설명 길이 최대 200, 좌표 100, 전화 100, 주소 50, 섬업이 직접 확인한 곳 150 */
    const d = (x.desc || x.summary || '').length;
    const info = 100 + (x.image ? 300 : 0) + Math.min(200, Math.round(d * 2.5)) + (x.lat && x.lng ? 100 : 0) + (x.tel && !/^-+$/.test(x.tel) ? 100 : 0) + (x.addr || x.address ? 50 : 0) + (x.source && !x.auto && !x.src ? 150 : 0);
    return { ...x, score: info, buzz: null }; });
}
module.exports = { ready, measure, attach, norm };
