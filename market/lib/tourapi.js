// 한국관광공사 국문 관광정보(TourAPI, 공공데이터포털 15101578)에서 제주 맛집·카페를 받아온다.
// 키는 환경변수에만 둔다: TOUR_API_KEY (없으면 DATA_GO_KR_KEY를 써 본다). 공공데이터포털에서 이 API의 활용신청이 되어 있어야 한다.
// 6시간 동안 기억해 둔다. 실패하면 빈 목록을 돌려주고 사이트는 그대로 돈다. AI는 쓰지 않는다.
const BASE = process.env.TOUR_API_BASE || 'https://apis.data.go.kr/B551011/KorService2'; // TOUR_API_BASE는 시험할 때만 쓴다
const TTL = 6 * 3600e3;
let cache = null;
const keyOf = () => process.env.TOUR_API_KEY || process.env.DATA_GO_KR_KEY || '';
const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const CAFE = /카페|커피|coffee|cafe|베이커리|디저트|찻집|다방|로스터|브런치/i;

function normalize(o) {
  const lat = Number(o.mapy), lng = Number(o.mapx); const inJeju = lat > 32 && lat < 35 && lng > 125 && lng < 128;
  const img = String(o.firstimage || o.firstimage2 || '').replace(/^http:\/\//, 'https://');
  const name = strip(o.title).slice(0, 80);
  return { id: 'k' + String(o.contentid || '').replace(/\D/g, '').slice(0, 12), name, addr: strip([o.addr1, o.addr2].filter(Boolean).join(' ')).slice(0, 120), desc: '', start: '', end: '', tel: strip(o.tel).slice(0, 30),
    image: /^https:\/\/[^\s"'<>]{8,300}$/.test(img) ? img : '', speed: null, cat: o.cat3 === 'A05020900' || CAFE.test(name) ? 'cafe' : 'food', lat: inJeju ? lat : null, lng: inJeju ? lng : null, src: '한국관광공사' };
}
async function page(key, n) {
  // 음식점(39), 제주(39). 서비스키는 포털에서 준 모양 그대로 넣는다 (이미 인코딩된 키와 아닌 키 모두 받게)
  const k = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
  const r = await fetch(`${BASE}/areaBasedList2?serviceKey=${k}&MobileOS=ETC&MobileApp=seomup&_type=json&areaCode=39&contentTypeId=39&arrange=Q&numOfRows=100&pageNo=${n}`, { signal: AbortSignal.timeout(8000) });
  const text = await r.text(); let d; try { d = JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
  const it = (((d.response || {}).body || {}).items || {}).item; return Array.isArray(it) ? it : it ? [it] : [];
}
async function load({ fresh = false } = {}) {
  const key = keyOf(); if (!key) return { ok: false, needs: 'TOUR_API_KEY', items: [] };
  if (!fresh && cache && Date.now() - cache.at < (cache.value.ok ? TTL : 10 * 60e3)) return cache.value;
  let value;
  try { const got = []; /* 한 번에 한 쪽씩 (동시에 부르면 일부가 실패한다). 실패한 쪽은 한 번 더 */
    for (const n of [1, 2, 3, 4]) { let g; for (let t = 0; t < 2; t++) { try { g = { status: 'fulfilled', value: await page(key, n) }; break; } catch (e) { g = { status: 'rejected', reason: e }; } } got.push(g); if (g.status === 'fulfilled' && g.value.length < 100) break; }
    const raw = got.flatMap((g) => (g.status === 'fulfilled' ? g.value : []));
    const seen = new Set(); const items = raw.map(normalize).filter((x) => x.id.length > 1 && x.name && !seen.has(x.id) && seen.add(x.id));
    value = { ok: items.length > 0, updatedAt: new Date().toISOString(), source: '한국관광공사', count: items.length, items, error: items.length ? '' : (got.find((g) => g.status === 'rejected')?.reason?.message || '받은 목록이 비어 있어요.').slice(0, 160) };
  } catch (e) { value = { ok: false, items: [], error: String(e.message).slice(0, 160) }; }
  cache = { at: Date.now(), value }; return value;
}
const peek = () => (cache ? cache.value.items || [] : []);
module.exports = { load, peek };
