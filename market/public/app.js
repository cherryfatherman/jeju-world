/* 섬업(부제 탐라도감) 공통 틀 v4: 상단(로고·큰 메뉴·검색·올리기) · 보조 탭 · 모바일 하단 탭 · 푸터
   섬업다움 세 가지: ① 모든 글 오른쪽의 '업'(추천) 버튼 ② 고리(링)로 이어진 큰 줄기 ③ 주황 + 민트, 둥근 모서리
   문구·메뉴는 /admin.html 에서 고친다. 디자인 원칙: docs/design/principles.md */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<em>$1</em>').replace(/ *\n/g, ' <br>');
const STAGE = { idea: '아이디어', demo: '데모', users: '사용자 있음', revenue: '매출 있음' };
const TYPE_LABEL = { home: '집', item: '물건', project: '프로젝트' };
const TYPE_ICON = { home: 'home', item: 'box', project: 'puzzle' };
let CONFIG = null;

// 큰 줄기(목차). 제일 앞이 본업인 '거래'. 보조 탭이 2개 이상일 때만 둘째 줄이 보인다.
const PRIMARY = [
  { key: 'deal', label: '장터', icon: 'puzzle', href: './market.html?type=project', subs: [['./market.html?type=project', '프로젝트', 'project'], ['./sell.html?type=project', '내 프로젝트 올리기', 'sell']] },
  { key: 'program', label: '창업마당', icon: 'coins', href: './board.html?kind=program', subs: [] },
  { key: 'insight', label: '인사이트', icon: 'bulb', href: './board.html?kind=insight', subs: [] },
  { key: 'hackathon', label: '해커톤', icon: 'trophy', href: './hackathon.html', subs: [['./hackathon.html', '열린 해커톤', 'hackathon'], ['./winners.html', '수상작 도감', 'winners']] },
  { key: 'jeju', label: '제주마당', icon: 'leaf', href: './jeju.html', subs: [['./jeju.html', '생활', 'jeju'], ['./places.html?type=spot', '여행', 'travel'], ['./market.html?type=home', '집', 'home'], ['./market.html?type=item', '물건', 'item']] },
];

const won = (n) => {
  n = Number(n) || 0; if (!n) return '';
  if (n >= 100000000) { const eok = Math.floor(n / 100000000), man = Math.round((n % 100000000) / 10000); return `${eok}억${man ? ` ${man.toLocaleString('ko-KR')}만` : ''} 원`; }
  if (n >= 10000) { const man = Math.floor(n / 10000), rest = n % 10000; return `${man.toLocaleString('ko-KR')}만${rest ? ` ${rest >= 1000 && rest % 1000 === 0 ? rest / 1000 + '천' : rest.toLocaleString('ko-KR')}` : ''} 원`; }
  return n.toLocaleString('ko-KR') + '원';
};

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  box: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>',
  puzzle: '<path d="M10 3h4v3a2 2 0 1 0 4 0h3v4h-3a2 2 0 1 0 0 4h3v4h-4v-3a2 2 0 1 0-4 0v3H6v-4H3v-4h3V7h4z"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 21h8M9 17h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.3 2A3.5 3.5 0 0 1 17 18z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12M8 7l4-4 4 4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2 2 4"/><path d="M11 15l1-5-3 1-2 3"/><path d="M12 10l3 1 3-2"/>',
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  leaf: '<path d="M5 20c0-9 5-14 14-14 0 9-5 14-14 14z"/><path d="M5 20c3-5 6-8 10-10"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  chev: '<path d="M6 15l6-6 6 6"/>',
  like: '<path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M7 11l4-8a2.5 2.5 0 0 1 2.5 2.5V9h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/>',
  coins: '<circle cx="9" cy="9" r="5"/><path d="M14.5 10.5a5 5 0 1 1-4 8"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>',
  cart: '<path d="M3 4h2.5l2.2 10.5h9.6L19.5 7H7"/><circle cx="9.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
  cap: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.8V16c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2v-4.2"/>',
  plane: '<path d="M3 13.5 21 4l-5 16-3.5-6.5z"/><path d="M12.5 13.5 21 4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  brief: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  paw: '<circle cx="7.5" cy="9" r="1.7"/><circle cx="12" cy="6.8" r="1.7"/><circle cx="16.5" cy="9" r="1.7"/><path d="M8 16.5c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.4-1.2 2.2-2.4 2.2-.6 0-1-.3-1.6-.3s-1 .3-1.6.3C9.2 18.7 8 17.9 8 16.5z"/>',
  scale: '<path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a2.8 2.8 0 0 0 5 0zM19 8l-2.5 6a2.8 2.8 0 0 0 5 0z"/>',
};
const icon = (name, cls = 'ic') => ICONS[name] ? `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>` : esc(name);

async function api(path, body, method) {
  const headers = { 'Content-Type': 'application/json' };
  const pw = sessionStorage.getItem('adminpw'); if (pw) headers['x-admin-password'] = pw;
  const r = await fetch(path, body !== undefined ? { method: method || 'POST', headers, body: JSON.stringify(body) } : { headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || '요청에 실패했어요');
  return d;
}
function toast(t) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.append(el); }
  el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}
function priceText(p) {
  if (p.dealType === 'cofounder') return '공동창업자 구함';
  if (p.dealType === 'open') return '오픈소스 · 후원';
  if (!p.priceMax) return '가격 협의';
  return p.priceMin && p.priceMin !== p.priceMax ? `${won(p.priceMin)} ~ ${won(p.priceMax)}` : won(p.priceMax);
}
function homePrice(h) {
  if (!h) return '가격 협의';
  if (h.deal === '매매' || h.deal === '전세') return h.deposit ? `${h.deal} ${won(h.deposit)}` : `${h.deal} · 협의`;
  if (h.monthly) return `${h.deposit ? won(h.deposit) + ' / ' : ''}월 ${won(h.monthly)}`;
  return '가격 협의';
}
function oneLabel(p) {
  if (p.type === 'home') return p.home?.deal && p.home.deal !== '미정' ? p.home.deal : '집';
  if (p.type === 'item') return p.condition || p.category || '물건';
  return STAGE[p.stage] || '프로젝트';
}
const listPrice = (p) => (p.type === 'home' ? homePrice(p.home) : priceText(p));
const initial = (name) => (name || '?').trim().charAt(0);

/* 상품형 카드 (장터 목록) — 사진 · 라벨 회색 작게 · 제목 2줄 · 가격 굵게 · 반응 */
function listingCard(p) {
  const a = document.createElement('a'); a.className = 'card'; a.href = `./project.html?id=${encodeURIComponent(p.id)}`;
  const photo = (p.photos || [])[0];
  let sub = p.tagline || '';
  if (p.type === 'home' && p.home) { const h = p.home; sub = [h.dong, h.areaM2 ? `${h.areaM2}㎡ · ${(h.areaM2 / 3.3058).toFixed(0)}평` : '', h.rooms, h.floor].filter(Boolean).join(' · ') || sub; }
  a.innerHTML = `<div class="pimg ratio43">${photo ? `<img src="${photo}" alt="" loading="lazy">` : `<div class="nophoto">${icon(TYPE_ICON[p.type] || 'puzzle')}</div>`}<button class="save" type="button" aria-label="추천">${icon('bookmark')}</button></div>
    <div class="meta"><span>${esc(oneLabel(p))}</span>${p.origin && p.type === 'project' ? `<span>${esc(p.origin)}</span>` : ''}</div>
    <h3>${esc(p.name)}</h3><p class="tag">${esc(sub)}</p>
    <div class="foot"><span class="price">${esc(listPrice(p))}</span><span class="heart">추천 ${p.interest || 0}${p.comments ? ` · 댓글 ${p.comments}` : ''}</span></div>`;
  a.querySelector('.save').onclick = async (e) => { e.preventDefault(); e.stopPropagation(); const btn = e.currentTarget; const r = await doUp('project', p.id); if (r) btn.classList.toggle('on', r.on); };
  return a;
}
/* 피드형 카드 (홈 "새로 올라온 글") — 정사각 사진, 오버레이 추천, 올린 분, 한 줄, 반응 수 */
function photoCard(p) {
  const a = document.createElement('a'); a.className = 'pcard'; a.href = `./project.html?id=${encodeURIComponent(p.id)}`;
  const photo = (p.photos || [])[0];
  a.innerHTML = `<div class="pimg">${photo ? `<img src="${photo}" alt="" loading="lazy">` : `<div class="nophoto">${icon(TYPE_ICON[p.type] || 'puzzle')}</div>`}<span class="ptype">${esc(TYPE_LABEL[p.type] || '')}</span><button class="save" type="button" aria-label="추천">${icon('bookmark')}</button></div>
    <div class="pwho"><span class="avatar">${esc(initial(p.seller))}</span><span class="who">${esc(p.seller || '익명')}</span></div>
    <p class="ptext">${esc(p.name)} <span class="muted">${esc(p.tagline || '')}</span></p>
    <div class="pmeta"><span class="price">${esc(listPrice(p))}</span><span>추천 ${p.interest || 0} · 댓글 ${p.comments || 0}</span></div>`;
  a.querySelector('.save').onclick = async (e) => { e.preventDefault(); e.stopPropagation(); const btn = e.currentTarget; const r = await doUp('project', p.id); if (r) btn.classList.toggle('on', r.on); };
  return a;
}

/* ── 섬업 부품 ① '업' 버튼: 모든 글 오른쪽에 붙는 추천. 한 사람이 글 하나에 한 번 ── */
const upKey = (kind, id) => (kind === 'project' ? 'int-' + id : kind === 'place' ? 'pv-' + id : `up-${kind}:${id}`);
const didUp = (kind, id) => { try { return !!localStorage.getItem(upKey(kind, id)); } catch { return false; } };
// 누르면 추천, 다시 누르면 취소. 결과 { votes, on } 또는 null
async function doUp(kind, id) {
  const was = didUp(kind, id);
  try {
    const d = await api(`/api/up/${kind}/${encodeURIComponent(id)}`, { undo: was });
    try { was ? localStorage.removeItem(upKey(kind, id)) : localStorage.setItem(upKey(kind, id), '1'); } catch {}
    toast(was ? '추천을 취소했어요' : '추천했어요');
    return { votes: d.votes, on: !was };
  } catch (err) { toast(err.message); return null; }
}
function upBtn(kind, id, votes, big) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'up' + (big ? ' big' : '') + (didUp(kind, id) ? ' on' : '');
  const label = () => { b.setAttribute('aria-label', `추천 ${b.querySelector('b').textContent}${b.classList.contains('on') ? ' (눌러서 취소)' : ''}`); b.setAttribute('aria-pressed', String(b.classList.contains('on'))); b.title = b.classList.contains('on') ? '다시 누르면 취소돼요' : '추천'; };
  b.innerHTML = `${icon('like')}<b>${(votes || 0).toLocaleString('ko-KR')}</b>${big ? '<span>추천</span>' : ''}`; label();
  b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); const r = await doUp(kind, id); if (!r) return; b.classList.toggle('on', r.on); b.querySelector('b').textContent = r.votes.toLocaleString('ko-KR'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); label(); };
  return b;
}
/* ── 섬업 부품 ② 순위 줄: 번호 · 사진 · 제목/한 줄 · 오른쪽에 업 ── */
/* 사진이 없는 글의 자동 그림: 주제에 맞는 아이콘과 색을 고르고, 글마다 빛줄기 모양이 조금씩 다르다 */
const COVER_TONES = [['#ff7a2e', '#ffb347'], ['#0f9f96', '#5fe0cf'], ['#5b4fe0', '#a79bff'], ['#2f7fe6', '#63cdf5'], ['#ff5e7a', '#ffa08a'], ['#26221d', '#5a5148']];
const COVER_TOPICS = [
  [/machine learning|\bai\b|인공지능|iot|blockchain|ar\/vr|robot|개발도구|데이터/i, 'chip', 2], [/health|fitness|elderly|senior|wellness|헬스|웰빙|medical|mental/i, 'heart', 4],
  [/school|tutor|education|교육|student|learn|beginner/i, 'cap', 3], [/video|media|social media|creator|미디어|크리에이터|design|music/i, 'film', 4],
  [/retail|commerce|invoice|커머스|소상공인|shop|market|booking/i, 'cart', 0], [/fintech|tax|finance|bank|money|payment|투자|자금/i, 'coins', 0],
  [/real estate|landlord|housing|부동산|주거|construction/i, 'home', 3], [/travel|tour|여행|관광|trip/i, 'plane', 3],
  [/agriculture|food waste|environment|climate|환경|농업|sustain|green/i, 'leaf', 1], [/pet|animal|반려/i, 'paw', 1],
  [/legal|law|immigrant|nonprofit|volunteer|social good|civic|지역|로컬|community|커뮤니티/i, 'scale', 1], [/translation|language|web|global|open ended/i, 'globe', 3],
  [/job|productivity|생산성|업무|logistics|low\/no code|work/i, 'brief', 5], [/hackathon|해커톤|prize|challenge/i, 'trophy', 0],
];
function coverArt(title, topic, fallbackIcon) {
  const text = `${topic || ''} ${title || ''}`; let h = 7; for (const ch of String(title || topic || 'x')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const hit = COVER_TOPICS.find(([re]) => re.test(text)); const ic = hit ? hit[1] : (fallbackIcon || 'puzzle'); const [a, b] = COVER_TONES[hit ? (hit[2] + (h % 3) * 2) % COVER_TONES.length : h % COVER_TONES.length]; // 같은 주제라도 색이 세 가지로 갈린다
  const r = (n, m) => ((h >>> n) % m); const cx = 20 + r(3, 60), cy = 15 + r(7, 40);
  const strands = Array.from({ length: 7 }, (_, i) => { const ang = (r(i + 2, 360) + i * 51) * Math.PI / 180, x = cx + Math.cos(ang) * 120, y = cy + Math.sin(ang) * 120, mx = (cx + x) / 2 + Math.sin(ang) * (10 + r(i, 26)), my = (cy + y) / 2 - Math.cos(ang) * (10 + r(i + 5, 26)); return `<path d="M${cx} ${cy}Q${mx.toFixed(0)} ${my.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}"/>`; }).join('');
  return `<span class="cover" style="background:linear-gradient(${120 + r(5, 80)}deg,${a},${b})"><svg class="cvs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${strands}<circle cx="${cx}" cy="${cy}" r="9"/></svg>${icon(ic, 'cvi')}</span>`;
}
function rankRow({ rank, href, external, image, iconName, title, sub, meta, badge, badgeTone, kind, id, votes, big, topic }) {
  const d = document.createElement('div'); d.className = 'rrow' + (big ? ' big' : '');
  const link = (cls, inner) => `<a class="${cls}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
  d.innerHTML = `${rank ? `<span class="rk${rank <= 3 ? ' top' : ''}">${rank}</span>` : ''}${link('rthumb', image ? `<img src="${esc(image)}" alt="" loading="lazy">` : coverArt(title, topic, iconName))}${link('rbody', `<span class="rtitle">${badge ? `<i class="rbadge ${badgeTone || ''}">${esc(badge)}</i>` : ''}<b>${esc(title)}</b></span>${sub ? `<p>${esc(sub)}</p>` : ''}${meta ? `<small>${esc(meta)}</small>` : ''}`)}`;
  d.append(upBtn(kind, id, votes));
  return d;
}
/* ── 섬업 부품 ③ 이야기(댓글): 어떤 글에도 붙인다 ── */
async function mountComments(el, kind, id) {
  el.classList.add('cbox');
  el.innerHTML = `<div class="sec-head"><h2>이야기</h2><span class="more" data-n></span></div>
    <form><input name="name" placeholder="닉네임" maxlength="20" aria-label="닉네임"><input name="text" placeholder="한마디 남기기" required maxlength="300" aria-label="댓글"><button class="btn primary">남기기</button></form>
    <div class="comments"></div>`;
  const url = `/api/comments/${kind}/${encodeURIComponent(id)}`;
  const one = (c, reply) => `<div class="comment${c.staff ? ' staff' : ''}${reply ? ' reply' : ''}" data-id="${esc(c.id)}"><div class="chead"><b>${esc(c.name || '익명')}</b>${c.staff ? `<i class="cstaff">${esc(c.role || 'AI 직원')}</i>` : c.owner ? '<i class="cstaff cowner">운영자</i>' : ''}<small>${new Date(c.createdAt).toLocaleDateString('ko-KR')}</small>${reply ? '' : '<button type="button" class="creply">답글</button>'}</div><p>${esc(c.text)}</p></div>`;
  const draw = (list) => {
    el.querySelector('[data-n]').textContent = list.length ? `${list.length}개` : '';
    const tops = list.filter((c) => !c.parent), kids = (pid) => list.filter((c) => c.parent === pid).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const orphans = list.filter((c) => c.parent && !tops.some((t) => t.id === c.parent));
    el.querySelector('.comments').innerHTML = list.length ? [...tops, ...orphans].map((c) => `<div class="cthread">${one(c, false)}${kids(c.id).map((k) => one(k, true)).join('')}</div>`).join('') : '<p class="note">첫 이야기를 남겨 주세요.</p>';
    el.querySelectorAll('.creply').forEach((b) => b.onclick = () => { const th = b.closest('.cthread'); if (th.querySelector('.rform')) { th.querySelector('.rform').remove(); return; }
      const f = document.createElement('form'); f.className = 'rform'; f.innerHTML = '<input name="name" placeholder="닉네임" maxlength="20" aria-label="닉네임"><input name="text" placeholder="답글 남기기" required maxlength="300" aria-label="답글"><button class="btn">남기기</button>';
      f.onsubmit = async (e) => { e.preventDefault(); try { draw(await api(url, { ...Object.fromEntries(new FormData(f)), parent: b.closest('.comment').dataset.id })); toast('남겼어요'); } catch (err) { toast(err.message); } };
      th.append(f); f.text.focus(); });
  };
  el.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { draw(await api(url, Object.fromEntries(new FormData(e.target)))); e.target.text.value = ''; toast('남겼어요'); } catch (err) { toast(err.message); } };
  try { draw(await api(url)); } catch { draw([]); }
}
const PROGRAM_STATUS = { open: '진행', done: '완료' };
const periodOf = (p) => p.periodText || (p.always ? '상시' : [p.start, p.end].filter(Boolean).join(' ~ '));
const programRow = (p, rank) => rankRow({ rank, href: `./post.html?kind=program&id=${encodeURIComponent(p.id)}`, image: p.image, iconName: 'coins', title: p.title, sub: p.summary, meta: [p.org, periodOf(p), p.comments ? `이야기 ${p.comments}` : ''].filter(Boolean).join(' · '), badge: PROGRAM_STATUS[p.status], badgeTone: p.status, kind: 'program', id: p.id, votes: p.votes });
const insightRow = (p, rank) => rankRow({ rank, href: `./post.html?kind=insight&id=${encodeURIComponent(p.id)}`, image: p.image, iconName: 'bulb', title: p.title, sub: p.summary, meta: [p.category, p.org, p.comments ? `이야기 ${p.comments}` : ''].filter(Boolean).join(' · '), kind: 'insight', id: p.id, votes: p.votes });
const projectRow = (p, rank) => rankRow({ rank, href: `./project.html?id=${encodeURIComponent(p.id)}`, image: (p.photos || [])[0], iconName: TYPE_ICON[p.type], title: p.name, sub: p.tagline, big: true, badge: p.staffIdea ? 'AI 제안' : p.type === 'project' && p.deal === 'done' ? '완료' : '', badgeTone: p.staffIdea ? 'open' : 'done', topic: [p.category, ...(p.tags || [])].join(' '), kind: 'project', id: p.id, votes: p.interest });
const guideRow = (g, rank) => rankRow({ rank, href: `./guide.html?id=${encodeURIComponent(g.id)}`, image: g.image, iconName: 'leaf', title: g.title, sub: g.summary, meta: [g.tag, g.comments ? `이야기 ${g.comments}` : ''].filter(Boolean).join(' · '), kind: 'guide', id: g.id, votes: g.votes });
const hackRow = (h, rank) => rankRow({ rank, href: h.url, external: true, iconName: 'trophy', topic: (h.themes || []).join(' ') + ' hackathon', title: h.title, sub: [h.dates, h.location].filter(Boolean).join(' · '), meta: [h.source === 'local' ? '국내 · 직접 등록' : 'Devpost', h.participants ? `${h.participants.toLocaleString()}명 참가` : '', h.prize ? `상금 ${h.prize}` : ''].filter(Boolean).join(' · '), kind: 'hackathon', id: h.id, votes: h.votes });

/* ── 바로가기 타일: 아이콘 + 이름 + (HOT/NEW). 설명 없이 누르고 싶게 ── */
function tileGroups(el, groups, extra = {}) {
  el.replaceChildren(...(groups || []).map((g) => { const box = document.createElement('div'); box.className = 'tiles2';
    box.innerHTML = (g.items || []).map((t) => `<a href="${esc(t.href || '#')}" class="tile2${t.accent ? ' accent' : ''}"><span class="ti">${icon(t.icon || 'grid')}</span><b>${esc(t.label)}</b>${extra[t.key] ? `<small>${esc(extra[t.key])}</small>` : ''}</a>`).join(''); return box; }));
}
const PLACE_LABEL = { spot: '관광지', cafe: '카페', food: '맛집' };
/* 장소 카드 (관광지·카페·맛집): 사진 · 순위 · 이름 · 동네 · 추천 수 */
function placeCard(p, rank) {
  const a = document.createElement('a'); a.className = 'gcard pcard2'; a.href = `./place.html?id=${encodeURIComponent(p.id)}`;
  a.innerHTML = `<div class="gimg">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}${rank ? `<span class="rank-n">${rank}</span>` : `<span class="gtag">${esc(PLACE_LABEL[p.type] || '')}</span>`}</div><b>${esc(p.name)}</b><p>${esc(p.summary || '')}</p><small>${esc(p.area || '')} · 추천 ${p.votes || 0}</small>`;
  return a;
}
/* 가이드 카드 */
function guideCard(g) {
  const a = document.createElement('a'); a.className = 'gcard'; a.href = `./guide.html?id=${encodeURIComponent(g.id)}`;
  a.innerHTML = `<div class="gimg">${g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy">` : ''}<span class="gtag">${esc(g.tag || '가이드')}</span></div><b>${esc(g.title)}</b><p>${esc(g.summary || '')}</p><small>추천 ${g.votes || 0} · ${esc(g.lastChecked || '')}</small>`;
  return a;
}
/* 아주 작은 마크다운: ## 제목, - 목록, 1. 목록, **굵게**, [글](주소), > 메모, 빈 줄 = 문단 */
function md(src) {
  const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => /^(https?:\/\/|\.\/|#)/.test(u) ? `<a href="${u}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${t}</a>` : t);
  const out = []; let list = null;
  const flush = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const raw of String(src).split('\n')) {
    const line = raw.trimEnd();
    let m;
    if ((m = /^##\s+(.*)/.exec(line))) { flush(); out.push(`<h2>${inline(m[1])}</h2>`); }
    else if ((m = /^###\s+(.*)/.exec(line))) { flush(); out.push(`<h3>${inline(m[1])}</h3>`); }
    else if ((m = /^[-*]\s+(.*)/.exec(line))) { if (!list || list.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] }; } list.items.push(inline(m[1])); }
    else if ((m = /^\d+\.\s+(.*)/.exec(line))) { if (!list || list.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] }; } list.items.push(inline(m[1])); }
    else if ((m = /^>\s?(.*)/.exec(line))) { flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); }
    else if (!line.trim()) { flush(); }
    else { flush(); out.push(`<p>${inline(line)}</p>`); }
  }
  flush(); return out.join('');
}

const JEJU_WORDS = [['혼저옵서예', '어서 오세요'], ['폭삭 속았수다', '정말 수고하셨습니다'], ['맨도롱 또똣', '따뜻하게, 알맞게 따끈한'], ['감수광', '가십니까?'], ['왕 봥 갑서', '와서 보고 가세요'], ['고맙수다', '고맙습니다'], ['놀멍 쉬멍', '놀면서 쉬면서'], ['도르멍', '빨리, 서둘러서'], ['하영', '많이'], ['지꺼지다', '기쁘다, 신나다'], ['소랑햄수다', '사랑합니다'], ['또시 봅주', '다시 봐요'], ['무사', '왜'], ['어떵 살암수과', '어떻게 지내세요?'], ['촘말로', '정말로']];
const todaysWord = () => JEJU_WORDS[Math.floor(Date.now() / 86400000) % JEJU_WORDS.length];
function countUp(el, to, ms = 800) { const start = performance.now(); const step = (t) => { const k = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString('ko-KR'); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function confetti(n = 30) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.createElement('div'); wrap.className = 'confetti'; document.body.append(wrap);
  for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.textContent = ['🍊', '✦', '🍊', '·'][i % 4]; s.style.left = Math.random() * 100 + 'vw'; s.style.animationDelay = Math.random() * .5 + 's'; s.style.fontSize = 12 + Math.random() * 16 + 'px'; s.style.color = 'var(--accent)'; wrap.append(s); }
  setTimeout(() => wrap.remove(), 3200);
}
async function share(title, text, url = location.href) {
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); } catch { prompt('링크를 복사하세요', url); }
}
try { fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: location.pathname.split('/').pop() || 'index.html' }) }); } catch {}

function initTheme(defaultTheme) {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  if (!t) { if (defaultTheme === 'day' || defaultTheme === 'night') t = defaultTheme; else { const h = new Date().getHours(); t = h >= 18 || h < 6 ? 'night' : 'day'; } }
  document.documentElement.dataset.theme = t;
}
const themeIcon = () => (document.documentElement.dataset.theme === 'night' ? icon('sun') : icon('moon'));
function toggleTheme() { const t = document.documentElement.dataset.theme === 'night' ? 'day' : 'night'; document.documentElement.dataset.theme = t; try { localStorage.setItem('theme', t); } catch {} $$('.themeBtn').forEach((b) => (b.innerHTML = themeIcon())); }
function applyColors(c) { if (!c) return; const r = document.documentElement.style; if (c.accent) r.setProperty('--accent', c.accent); if (c.accent2) r.setProperty('--accent-2', c.accent2); }

/* 배너 배경(캐러셀 1장용): 능선·바다·달·등불, 저채도 */
function bannerSVG() {
  const lanterns = Array.from({ length: 9 }, (_, i) => { const x = 80 + i * 140; const y = 30 + Math.sin(i * 1.3) * 5; return `<g class="lan" style="animation-delay:${(i % 4) * .5}s"><line x1="${x}" y1="${y - 10}" x2="${x}" y2="${y}" stroke="var(--ink-4)" stroke-width="1.5"/><g class="bulb"><ellipse cx="${x}" cy="${y + 9}" rx="7" ry="10" fill="var(--lan1)"/><path d="M${x - 7} ${y + 9} a7 10 0 0 0 14 0z" fill="var(--lan2)"/></g></g>`; }).join('');
  return `<svg class="banner-art" viewBox="0 0 1320 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient></defs><rect width="1320" height="300" fill="url(#sky)"/><circle cx="1150" cy="70" r="26" fill="var(--moon)"/><g class="stars" fill="#fff" opacity=".8"><circle cx="220" cy="50" r="1.2"/><circle cx="480" cy="30" r="1"/><circle cx="800" cy="46" r="1.3"/><circle cx="990" cy="24" r="1"/></g><path d="M0 210 L260 140 L420 170 L600 110 L720 90 L840 120 L1000 160 L1160 140 L1320 190 L1320 300 L0 300z" fill="var(--mtn1)"/><path d="M0 242 L180 205 L340 228 L520 196 L700 220 L880 192 L1060 224 L1220 202 L1320 234 L1320 300 L0 300z" fill="var(--mtn2)"/><rect y="266" width="1320" height="34" fill="var(--sea)"/><path d="M40 20 Q 660 2 1280 20" stroke="var(--ink-4)" stroke-width="1.5" fill="none"/>${lanterns}</svg>`;
}

/* ── 상단 · 보조 탭 · 하단 탭 · 푸터 ── */
async function mountShell({ active, primary, sub } = {}) {
  // 1) 지난 방문 때 저장해 둔 설정으로 상단을 즉시 그린다. 처음이면 기본값.
  let cached = null; try { cached = JSON.parse(localStorage.getItem('cfg') || 'null'); } catch {}
  const S0 = cached?.site || { name: '섬업', sub: '' };
  document.documentElement.dataset.theme = 'day'; if (cached) { applyColors(cached.colors); applyTheme(cached.theme); }
  // 홈 화면에 추가하면 앱처럼 열리게 (설정 파일 + 아이콘)
  if (!$('link[rel=manifest]')) {
    const add = (tag, attrs) => { const el = document.createElement(tag); Object.assign(el, attrs); document.head.append(el); };
    add('link', { rel: 'manifest', href: './manifest.webmanifest' });
    add('link', { rel: 'apple-touch-icon', href: './icons/apple-touch-icon.png' });
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-title', content: '섬업' });
  }
  if (!$('link[rel=icon]')) { const l = document.createElement('link'); l.rel = 'icon'; l.href = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#fff"/><rect x="22" y="12" width="56" height="76" rx="9" fill="#ff6b1a"/><path d="M60 12h11v28l-5.5-4.5L60 40z" fill="#1b1915" opacity=".28"/><circle cx="46" cy="58" r="15" fill="#fff"/><path d="M46 44c0-4.5 4.5-8.2 10.5-7.5-1 5.5-5.5 8.2-10.5 7.5z" fill="#19b3a6"/></svg>')}`; document.head.append(l); }
  const pkey = primary || ({ winners: 'hackathon', hackathon: 'hackathon', market: 'jeju', jeju: 'jeju', project: 'deal', deal: 'deal', program: 'program', insight: 'insight' }[active] || '');
  const header = document.createElement('header'); header.className = 'top';
  header.innerHTML = `<div class="wrap bar">
      <a class="logo" href="./"><span class="mark"><svg viewBox="0 0 100 100" aria-hidden="true"><rect x="18" y="10" width="64" height="80" rx="9" fill="#ff6b1a"/><path d="M62 10h12v30l-6-5-6 5z" fill="#1b1915" opacity=".28"/><circle cx="46" cy="58" r="16" fill="#fff"/><path d="M46 43c0-4.8 4.8-8.8 11.2-8-1.1 5.9-5.9 8.8-11.2 8z" fill="#19b3a6"/></svg></span><span class="lname">${esc(S0.name)}</span><small class="lsub" ${S0.sub ? '' : 'hidden'}>${esc(S0.sub || '')}</small></a>
      <nav class="primary">${PRIMARY.map((p) => `<a href="${p.href}" class="${p.key === pkey ? 'on' : ''}">${p.label}</a>`).join('')}</nav>
      <form class="search" role="search" action="./search.html"><span class="sic">${icon('search')}</span><input name="q" placeholder="검색" autocomplete="off" aria-label="검색"></form>
      <div class="acts"><a class="btn write" href="./sell.html">${icon('plus')}<span>올리기</span></a></div>
    </div>`;
  document.body.prepend(header);
  const mnav = document.createElement('nav'); mnav.className = 'mnav';
  mnav.innerHTML = `<div class="wrap">${PRIMARY.map((p) => `<a href="${p.href}" class="${p.key === pkey ? 'on' : ''}">${p.label}</a>`).join('')}</div>`;
  header.after(mnav);
  const P = PRIMARY.find((p) => p.key === pkey);
  if (P && P.subs.length > 1) {
    const bar = document.createElement('div'); bar.className = 'subnav';
    const here = location.pathname.split('/').pop() || 'index.html';
    bar.innerHTML = `<div class="wrap">${P.subs.map(([href, label, key]) => { const on = sub ? key === sub : (href.split('?')[0].split('#')[0].replace('./', '') || 'index.html') === here && !href.includes('?') && !href.includes('#'); return `<a href="${href}" class="${on ? 'on' : ''}">${label}</a>`; }).join('')}</div>`;
    mnav.after(bar);
  }
  const tabs = document.createElement('nav'); tabs.className = 'tabbar';
  const t = [['./', 'home', '홈', 'home'], ['./market.html?type=project', 'puzzle', '장터', 'deal'], ['./sell.html', 'plus', '올리기', 'sell'], ['./board.html?kind=program', 'coins', '창업마당', 'program'], ['./jeju.html', 'leaf', '제주마당', 'jeju']];
  tabs.innerHTML = t.map(([href, ic, label, key]) => `<a href="${href}" class="${key === 'sell' ? 'write' : ''} ${key === active || key === pkey ? 'on' : ''}">${icon(ic)}<span>${label}</span></a>`).join('');
  document.body.append(tabs);
  const up = document.createElement('button'); up.className = 'totop'; up.setAttribute('aria-label', '맨 위로'); up.innerHTML = icon('up'); up.onclick = () => scrollTo({ top: 0, behavior: 'smooth' }); document.body.append(up);
  addEventListener('scroll', () => up.classList.toggle('show', scrollY > 600), { passive: true });

  mountPageFx(); mountTransitions(); mountReveal();
  // 2) 최신 설정을 받아 반영하고 다음 방문을 위해 저장한다
  CONFIG = await api('/api/config');
  const S = CONFIG.site; applyColors(CONFIG.colors); applyTheme(CONFIG.theme);
  try { localStorage.setItem('cfg', JSON.stringify({ site: { name: S.name, sub: S.sub }, colors: CONFIG.colors, theme: CONFIG.theme })); } catch {}
  header.querySelector('.lname').textContent = S.name; header.querySelector('.lsub').textContent = S.sub || ''; header.querySelector('.lsub').hidden = !S.sub;
  for (const [k, v] of [['og:title', document.title], ['og:description', $('meta[name=description]')?.content || S.slogan], ['og:type', 'website'], ['og:site_name', S.name]]) { if (!$(`meta[property="${k}"]`)) { const m = document.createElement('meta'); m.setAttribute('property', k); m.content = v; document.head.append(m); } }
  mountAds(CONFIG.ads);
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap"><div><b>${esc(S.name)}</b>${S.sub ? ` <span class="small">${esc(S.sub)}</span>` : ''} · ${esc(S.slogan)}<br><span class="small">${esc(CONFIG.footer?.note || '')}</span></div><div class="links"><a href="./about.html">운영 원칙</a><a href="./admin.html">관리자</a></div></div>`;
  document.body.append(footer);
  applyTexts(); mountEditor();
  return CONFIG;
}

/* 광고 배너 (디자인은 코드로 그림: 청록/주황 테마, 아이콘 패턴, 노트북 청년) */
function adCard(ad, side) {
  const a = document.createElement('a'); a.className = `ad ${ad.theme || 'teal'} ${side}`; a.href = ad.href || '#'; a.target = '_blank'; a.rel = 'noopener sponsored';
  a.innerHTML = `<span class="adimg" style="${ad.image ? `background-image:url('${esc(ad.image)}')` : ''}"></span><span class="adlabel">${esc(ad.label || '광고')}</span>
    <div class="adbody"><p class="kicker">${esc(ad.kicker || '')}</p><h3>${rich(ad.title || '')}</h3>${(ad.points || []).length ? `<ul>${ad.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ad.sub ? `<p class="sub">${esc(ad.sub)}</p>` : ''}<span class="go">${esc(ad.cta || '자세히')} ${icon('arrow')}</span></div>`;
  return a;
}
function mountAds(ads) {
  if (!ads || ads.enabled === false) return;
  const wrap = document.createElement('div'); wrap.className = 'ads';
  if (ads.left?.title) wrap.append(adCard(ads.left, 'left'));
  if (ads.right?.title) wrap.append(adCard(ads.right, 'right'));
  document.body.append(wrap);
}

/* 알림 받기 모달 (홈·검색 등에서 호출) */
function mountWaitlist() {
  if ($('#wantModal')) return;
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'wantModal';
  m.innerHTML = `<form class="form" id="wantForm"><h3>새 글 알림 받기</h3><p class="note">원하는 글이 올라오면 알려드려요. 스팸은 보내지 않아요.</p>
    <label>나는<select name="role"><option value="buy">찾고 있어요 (집·물건·프로젝트)</option><option value="sell">내놓을 게 있어요</option><option value="both">둘 다요</option></select></label>
    <label>연락처 (이메일 또는 스레드 아이디)<input name="contact" required placeholder="you@example.com 또는 @threads_id"></label>
    <label>찾는 것 (선택)<input name="note" placeholder="예: 아라동 원룸 월 40 이하 / 중고 자전거"></label>
    <div class="actions"><button type="button" class="btn" data-close>닫기</button><button class="btn primary">알림 받기</button></div></form>`;
  document.body.append(m);
  m.querySelector('[data-close]').onclick = () => m.classList.remove('show');
  m.onclick = (e) => { if (e.target === m) m.classList.remove('show'); };
  $('#wantForm').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/waitlist', Object.fromEntries(new FormData(e.target))); m.classList.remove('show'); e.target.reset(); toast('알림을 신청했어요'); document.dispatchEvent(new Event('stats:refresh')); } catch (err) { toast(err.message); } };
  return m;
}


/* ════════ 보면서 고치기 (수정 모드) ════════
   운영자가 사이트를 보면서 글꼴·색·크기·모서리·글자를 바로 고친다. 저장하면 config.json의 theme·texts에 들어가 모든 방문자에게 반영된다. */
const FONTS = [['Pretendard Variable', '프리텐다드 (기본)', ''], ['Noto Sans KR', '노토 산스', 'Noto+Sans+KR:wght@400;500;700;900'], ['IBM Plex Sans KR', 'IBM 플렉스 산스', 'IBM+Plex+Sans+KR:wght@400;500;600;700'], ['Gowun Dodum', '고운돋움', 'Gowun+Dodum'], ['Nanum Gothic', '나눔고딕', 'Nanum+Gothic:wght@400;700;800'], ['Nanum Myeongjo', '나눔명조', 'Nanum+Myeongjo:wght@400;700;800'], ['Gowun Batang', '고운바탕', 'Gowun+Batang:wght@400;700'], ['Jua', '주아', 'Jua'], ['Do Hyeon', '도현', 'Do+Hyeon'], ['Black Han Sans', '검은고딕 (제목용)', 'Black+Han+Sans'], ['Gothic A1', '고딕 A1', 'Gothic+A1:wght@400;500;700;900']];
const THEME_FIELDS = [
  ['글꼴', [['bodyFont', '본문 글꼴', 'font'], ['headFont', '제목 글꼴', 'font'], ['headWeight', '제목 굵기', 'range', 500, 900, 100], ['scale', '전체 크기 (%)', 'range', 85, 120, 1], ['letter', '자간 (em)', 'range', -0.04, 0.04, 0.005]]],
  ['색', [['accent', '포인트 색', 'color'], ['accent2', '보조 색', 'color'], ['bg', '바탕', 'color'], ['surface', '카드 바탕', 'color'], ['ink', '글자', 'color'], ['line', '선', 'color']]],
  ['모양', [['radius', '카드 모서리 (px)', 'range', 0, 24, 1], ['btnRadius', '버튼 모서리 (px)', 'range', 0, 24, 1], ['wrap', '본문 폭 (px)', 'range', 900, 1320, 20], ['heroH', '홈 큰 배너 높이 (px)', 'range', 240, 560, 10], ['thumb', '목록 사진 크기 (px)', 'range', 48, 112, 4], ['gap', '구역 사이 간격 (px)', 'range', 16, 64, 4]]],
];
const THEME_DEFAULT = { v: 4, bodyFont: 'Pretendard Variable', headFont: 'Pretendard Variable', headWeight: 800, scale: 100, letter: -0.01, accent: '#ff6b1a', accent2: '#19b3a6', bg: '#ffffff', surface: '#ffffff', ink: '#1b1915', line: '#e9e3da', radius: 12, btnRadius: 8, wrap: 1080, heroH: 360, thumb: 96, gap: 32 };
const normTheme = (t) => { const T = { ...THEME_DEFAULT, ...(t || {}) }; if (!t || t.v !== 4) Object.assign(T, { v: 4, thumb: THEME_DEFAULT.thumb, bg: THEME_DEFAULT.bg, surface: THEME_DEFAULT.surface, ink: THEME_DEFAULT.ink, line: THEME_DEFAULT.line, radius: THEME_DEFAULT.radius, btnRadius: THEME_DEFAULT.btnRadius, gap: THEME_DEFAULT.gap }); return T; };
function loadFont(name) { const f = FONTS.find((x) => x[0] === name); if (!f || !f[2] || document.querySelector(`link[data-font="${name}"]`)) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.font = name; l.href = `https://fonts.googleapis.com/css2?family=${f[2]}&display=swap`; document.head.append(l); }
function applyTheme(t) {
  if (!t) return; const r = document.documentElement.style; const T = normTheme(t);
  const fb = ', "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';
  loadFont(T.bodyFont); loadFont(T.headFont);
  r.setProperty('--font', `"${T.bodyFont}"${fb}`); r.setProperty('--font-head', `"${T.headFont}"${fb}`); r.setProperty('--head-weight', T.headWeight);
  r.setProperty('--ls', T.letter + 'em'); r.setProperty('--accent', T.accent); r.setProperty('--accent-2', T.accent2); r.setProperty('--bg', T.bg); r.setProperty('--surface', T.surface); r.setProperty('--ink', T.ink); r.setProperty('--line', T.line);
  r.setProperty('--r-m', T.radius + 'px'); r.setProperty('--r-s', T.btnRadius + 'px'); r.setProperty('--wrap', T.wrap + 'px'); r.setProperty('--hero-h', T.heroH + 'px'); r.setProperty('--thumb', T.thumb + 'px'); r.setProperty('--sec-gap', T.gap + 'px');
  r.setProperty('--scale', String(T.scale / 100));
}
// 글자: 페이지에 박혀 있는 제목(h2 등)은 '페이지#순서'로, 설정에 묶인 글은 data-edit="경로"로 찾는다
const pageKey = () => (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
const autoTexts = () => $$('main .sec-head h2:not([id]), main .page-title h1:not([id]), main .page-title p:not([id])');
function applyTexts() { const X = CONFIG.texts || {}; autoTexts().forEach((el, i) => { const k = `${pageKey()}#${i}`; el.dataset.tkey = k; if (X[k]) el.textContent = X[k]; }); }
const getPath = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
function setPath(o, path, v) { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach((k) => { x = x[k] = x[k] ?? {}; }); x[ks[ks.length - 1]] = v; }
function mountEditor() {
  const hasPw = () => !!sessionStorage.getItem('adminpw');
  if (!hasPw() && !new URLSearchParams(location.search).has('edit')) return;
  if ($('#edFab')) return;
  const fab = document.createElement('button'); fab.id = 'edFab'; fab.type = 'button'; fab.textContent = '수정'; document.body.append(fab);
  const panel = document.createElement('aside'); panel.id = 'edPanel';
  let T = normTheme(CONFIG.theme), textMode = false, dirty = false;
  const field = ([k, label, type, min, max, step]) => type === 'font' ? `<label>${label}<select data-th="${k}">${FONTS.map((f) => `<option value="${f[0]}" ${T[k] === f[0] ? 'selected' : ''}>${f[1]}</option>`).join('')}</select></label>`
    : type === 'color' ? `<label class="edc">${label}<span><input type="color" data-th="${k}" value="${T[k]}"><code>${T[k]}</code></span></label>`
    : `<label>${label} <b data-out="${k}">${T[k]}</b><input type="range" data-th="${k}" min="${min}" max="${max}" step="${step}" value="${T[k]}"></label>`;
  panel.innerHTML = `<div class="edhead"><b>보면서 고치기</b><button type="button" data-x aria-label="닫기">✕</button></div>
    <div class="edbody">
      <div class="edsec"><h4>글자 직접 고치기</h4><p>켜면 점선으로 표시된 글자를 눌러 바로 고칠 수 있어요. 강조는 [대괄호], 줄바꿈은 엔터.</p><button type="button" class="btn" data-text>글자 고치기 켜기</button></div>
      ${THEME_FIELDS.map(([name, fs]) => `<div class="edsec"><h4>${name}</h4>${fs.map(field).join('')}</div>`).join('')}
      <div class="edsec"><h4>글 내용</h4><p>프로젝트·지원사업·인사이트·생활정보 같은 글 자체는 관리자에서 고쳐요.</p><a class="btn" href="./admin.html">관리자 열기</a> <a class="btn" href="./hq.html">본부</a></div>
    </div>
    <div class="edfoot"><button type="button" class="btn" data-reset>처음 디자인으로</button><button type="button" class="btn primary" data-save>저장</button></div>`;
  document.body.append(panel);
  const open = async () => {
    if (!hasPw()) { const pw = prompt('관리자 비밀번호'); if (!pw) return; try { await api('/api/admin/login', { password: pw }); sessionStorage.setItem('adminpw', pw); } catch (e) { return toast(e.message); } }
    panel.classList.add('show'); document.body.classList.add('ed-open');
  };
  fab.onclick = () => (panel.classList.contains('show') ? close() : open());
  const close = () => { panel.classList.remove('show'); document.body.classList.remove('ed-open'); };
  panel.querySelector('[data-x]').onclick = close;
  panel.querySelectorAll('[data-th]').forEach((inp) => inp.oninput = () => { const k = inp.dataset.th; T[k] = inp.type === 'range' ? Number(inp.value) : inp.value; const out = panel.querySelector(`[data-out="${k}"]`); if (out) out.textContent = T[k]; if (inp.type === 'color') inp.nextElementSibling.textContent = inp.value; applyTheme(T); dirty = true; });
  // 글자 고치기
  const targets = () => [...autoTexts(), ...$$('[data-edit]')];
  const setText = (on) => { textMode = on; document.body.classList.toggle('ed-text', on); panel.querySelector('[data-text]').textContent = on ? '글자 고치기 끄기' : '글자 고치기 켜기';
    targets().forEach((el) => { if (on) { if (el.dataset.edit) { el.dataset.shown = el.innerHTML; el.innerText = String(getPath(CONFIG, el.dataset.edit) ?? ''); } el.contentEditable = 'plaintext-only'; if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'; el.oninput = () => { dirty = true; }; const a2 = el.closest('a'); if (a2) a2.addEventListener('click', stop, true); }
      else { el.contentEditable = 'false'; const a2 = el.closest('a'); if (a2) a2.removeEventListener('click', stop, true); } }); };
  const stop = (e) => { if (textMode) e.preventDefault(); };
  panel.querySelector('[data-text]').onclick = () => setText(!textMode);
  panel.querySelector('[data-reset]').onclick = () => { if (!confirm('글꼴·색·모양을 처음 디자인으로 되돌릴까요? (글자는 그대로)')) return; T = { ...THEME_DEFAULT }; applyTheme(T); dirty = true; panel.querySelectorAll('[data-th]').forEach((inp) => { inp.value = T[inp.dataset.th]; const out = panel.querySelector(`[data-out="${inp.dataset.th}"]`); if (out) out.textContent = T[inp.dataset.th]; if (inp.type === 'color') inp.nextElementSibling.textContent = inp.value; }); };
  panel.querySelector('[data-save]').onclick = async () => {
    try {
      const cfg = await api('/api/config'); cfg.theme = T; cfg.colors = { ...(cfg.colors || {}), accent: T.accent, accent2: T.accent2 }; cfg.texts = cfg.texts || {};
      if (textMode) targets().forEach((el) => { const v = el.innerText.replace(/\n+$/, ''); if (el.dataset.edit) setPath(cfg, el.dataset.edit, v); else if (el.dataset.tkey) cfg.texts[el.dataset.tkey] = v; });
      await api('/api/config', cfg, 'PUT'); dirty = false; toast('저장했어요'); if (textMode) setTimeout(() => location.reload(), 500);
    } catch (e) { toast(e.message); }
  };
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  if (new URLSearchParams(location.search).has('edit')) open();
}


/* ════════ 빛 (v9): 섬업의 움직임 ════════
   홈 첫 화면의 빛줄기를 사이트 전체의 결로 쓴다: 페이지 위쪽의 은은한 빛 띠, 페이지를 넘길 때의 빛 한 줄, 내용이 떠오르는 등장. */
const FX = {
  ease: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)),
  reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  fit(cv, cap = 1.75) { const D = Math.min(window.devicePixelRatio || 1, cap), W = Math.max(1, cv.clientWidth), H = Math.max(1, cv.clientHeight); if (cv.width !== Math.round(W * D) || cv.height !== Math.round(H * D)) { cv.width = Math.round(W * D); cv.height = Math.round(H * D); } return { W, H, D }; },
  makeStrands: (n) => Array.from({ length: n }, () => ({ a: Math.random() * 6.28, r: .6 + Math.random() * .6, sp: .2 + Math.random() * .6, w: .5 + Math.random() * 1.6, hue: Math.random(), bend: (Math.random() - .5) * 1.6 })),
  // 바깥에서 (cx, cy)로 흘러드는 빛줄기. f: 얼마나 들어왔나(0~1), al: 밝기
  strands(c, S, cx, cy, R, tt, f, al, squash = .8) {
    for (const s of S) { const a = s.a + Math.sin(tt * s.sp * .5 + s.a) * .12, x0 = cx + Math.cos(a) * R * s.r, y0 = cy + Math.sin(a) * R * s.r * squash, mx = cx + Math.cos(a + s.bend) * R * .28, my = cy + Math.sin(a + s.bend) * R * .28 * squash, ex = x0 + (cx - x0) * f, ey = y0 + (cy - y0) * f;
      const col = s.hue < .62 ? `255,${110 + (s.hue * 120 | 0)},26` : s.hue < .86 ? '255,200,120' : '25,224,200', g = c.createLinearGradient(x0, y0, ex, ey);
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.55, `rgba(${col},${.16 * al})`); g.addColorStop(1, `rgba(${col},${.7 * al})`);
      c.strokeStyle = g; c.lineWidth = s.w; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + (mx - x0) * f, y0 + (my - y0) * f, ex, ey); c.stroke(); }
  },
  // 숫자가 올라가며 나타난다 ("600억" → 0억 … 600억)
  count(el) { const full = el.textContent, m = /^([\d,]+)(.*)$/.exec(full.trim()); if (!m || FX.reduced()) return; const to = Number(m[1].replace(/,/g, '')), t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('ko-KR') + m[2]; if (k < 1) requestAnimationFrame(step); else el.textContent = full; }; requestAnimationFrame(step); },
};
/* 페이지 위쪽의 빛 띠 (홈 제외). 제목 뒤에서 빛줄기가 한 점으로 모인다 */
function mountPageFx() {
  const main = $('main'); if (!main || $('.hero2') || $('.pagefx')) return;
  const d = document.createElement('div'); d.className = 'pagefx'; d.setAttribute('aria-hidden', 'true'); main.before(d);
}
/* 네이버 지도를 불러온다. 쓸 수 있으면 true, 안 되면(키 없음·막힘·인증 실패) false → 원래 지도로 그린다 */
let naverReady;
function loadNaverMap() {
  if (naverReady) return naverReady;
  const id = ((typeof CONFIG === 'object' && CONFIG && CONFIG.maps) || {}).naverClientId;
  naverReady = new Promise((res) => {
    if (!id) return res(false);
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    window.navermap_authFailure = () => { window.__naverAuthFailed = true; fin(false); document.dispatchEvent(new Event('naver-auth-failed')); };
    const sc = document.createElement('script'); sc.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(id)}`;
    sc.onload = () => setTimeout(() => fin(!!(window.naver && naver.maps && naver.maps.Map) && !window.__naverAuthFailed), 500);
    sc.onerror = () => fin(false); setTimeout(() => fin(false), 5000); document.head.append(sc);
  });
  return naverReady;
}
/* 네이버 지도에 동네 단위 점을 찍는다 */
function naverPins(el, center, pts) {
  const nm = naver.maps, map = new nm.Map(el, { center: new nm.LatLng(center.lat, center.lng), zoom: 10, scrollWheel: false, zoomControl: true, zoomControlOptions: { position: nm.Position.TOP_LEFT } });
  const info = new nm.InfoWindow({ borderWidth: 0, backgroundColor: 'transparent', disableAnchor: true, pixelOffset: new nm.Point(0, -6) });
  const first = new nm.LatLng(pts[0].lat, pts[0].lng), bounds = new nm.LatLngBounds(first, first);
  for (const p of pts) { const pos = new nm.LatLng(p.lat, p.lng); bounds.extend(pos);
    const m = new nm.Marker({ position: pos, map, title: p.title, icon: { content: '<div class="pin" style="background:#ff6b1a"></div>', anchor: new nm.Point(11, 22) } });
    nm.Event.addListener(m, 'click', () => { info.setContent(`<div class="pop npop"><small>${esc(p.area)}</small><b>${esc(p.title)}</b><a href="${esc(p.href)}">자세히 보기</a></div>`); info.open(map, m); }); }
  nm.Event.addListener(map, 'click', () => info.close());
  if (pts.length > 1) { map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 }); if (map.getZoom() > 12) map.setZoom(12); } else { map.setCenter(first); map.setZoom(12); }
  return map;
}
/* 제주 교통정보센터 자료(도로 통제·전기차 충전소·관광지)를 한 구역에 그린다. 받은 것이 없으면 구역을 숨긴 채로 둔다 */
async function itsSection(sec, kind, { first = 6, cat = '' } = {}) {
  if (!sec) return; let d; try { d = itsSection.cache[kind] || (itsSection.cache[kind] = await api('/api/jeju/its/' + kind + (cat ? '?all=1' : ''))); } catch { return; }
  const items = (d.items || []).filter((x) => (x.name || x.addr) && (!cat || x.cat === cat)); if (!d.ok || !items.length) { sec.hidden = true; return; }
  const row = (x) => { const period = [x.start, x.end].filter(Boolean).join(' ~ '), sub = [x.name ? x.addr : '', x.desc, period, x.tel].filter(Boolean).join(' · ');
    return `<div class="row"><div class="body"><b>${esc(x.name || x.addr)}</b>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>`; };
  const list = sec.querySelector('.list'), more = sec.querySelector('.itsmore'), note = sec.querySelector('.note'), cnt = sec.querySelector('.more');
  if (kind === 'tour') { /* 관광지·카페·맛집: 위 목록과 같은 모양(그림 + 추천 버튼)으로 */
    const T = { spot: ['travel 관광', 'sun'], cafe: ['retail 카페', 'chat'], food: ['food 맛집', 'grid'] }[cat || 'spot']; let shown = first;
    const paint = () => { list.className = 'list rlist'; list.replaceChildren(...items.slice(0, shown).map((x, i) => rankRow({ rank: i + 1, href: `https://map.naver.com/p/search/${encodeURIComponent(x.addr || x.name)}`, external: true, image: x.image, iconName: T[1], topic: T[0], title: x.name || x.addr, sub: x.name ? x.addr : x.desc, meta: [x.name ? x.desc : '', x.tel && !/^-+$/.test(x.tel) ? x.tel : ''].filter(Boolean).join(' · '), kind: 'tour', id: x.id, votes: x.votes || 0 })));
      if (more) { more.hidden = false; more.textContent = shown < Math.min(items.length, 60) ? '더 보기' : '전체 보기 (지도·검색)'; more.onclick = () => { if (shown < Math.min(items.length, 60)) { shown += 12; paint(); } else location.href = './info.html?kind=tour&type=' + (cat || 'spot'); }; } };
    paint();
  } else {
  list.innerHTML = items.slice(0, first).map(row).join('');
  if (more) { more.hidden = false; more.textContent = '전체 보기'; more.onclick = () => { location.href = './info.html?kind=' + kind + (cat ? '&type=' + cat : ''); }; }
  }
  if (cnt) cnt.textContent = `${(cat ? items.length : d.count || items.length).toLocaleString('ko-KR')}곳`.replace('곳', kind === 'road' ? '건' : '곳');
  if (note) note.textContent = `출처: ${d.source} OPEN API · ${new Date(d.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 기준`;
  sec.hidden = false; if (!FX.reduced()) sec.classList.add('in');
}
itsSection.cache = {};
/* 페이지 넘김: 떠날 때 내용이 살짝 올라가며 사라지고 위에 빛 한 줄이 지나간다. 새 페이지는 아래에서 떠오른다 */
function mountTransitions() {
  if (mountTransitions.done) return; mountTransitions.done = true;
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download') || document.body.classList.contains('ed-text')) return;
    let u; try { u = new URL(a.href, location.href); } catch { return; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
    e.preventDefault(); document.documentElement.classList.add('pt-out'); setTimeout(() => { location.href = a.href; }, FX.reduced() ? 0 : 230);
  });
  addEventListener('pageshow', () => document.documentElement.classList.remove('pt-out'));
}
/* 구역이 화면에 들어올 때 떠오른다 */
function mountReveal() {
  if (FX.reduced() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .04, rootMargin: '0px 0px -5% 0px' });
  $$('main > section, main > .two > section').forEach((el) => { el.classList.add('rv'); io.observe(el); });
  // 안전장치: 관찰이 늦어도 화면 안에 있는 구역은 반드시 보이게
  setTimeout(() => $$('.rv:not(.in)').forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); }), 1200);
}
