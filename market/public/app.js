/* 바톤 공통 틀 v3 (오늘의집식 구조): 상단(로고·큰 메뉴·검색·올리기) · 보조 탭 · 모바일 하단 탭 · 푸터
   문구·메뉴는 /admin.html 에서 고친다. 디자인 원칙: docs/design/principles.md */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<em>$1</em>').replace(/\n/g, '<br>');
const STAGE = { idea: '아이디어', demo: '데모', users: '사용자 있음', revenue: '매출 있음' };
const TYPE_LABEL = { home: '집', item: '물건', project: '프로젝트' };
const TYPE_ICON = { home: 'home', item: 'box', project: 'puzzle' };
let CONFIG = null;

// 큰 메뉴 3개와 각 메뉴의 보조 탭 (오늘의집: 집구경 · 쇼핑 · 인테리어/생활 → 바톤: 구경 · 장터 · 제주생활)
const PRIMARY = [
  { key: 'browse', label: '구경', href: './', subs: [['./', '추천', 'home'], ['./market.html?type=home', '집'], ['./market.html?type=item', '물건'], ['./market.html?type=project', '프로젝트'], ['./market.html#hackathons', '해커톤'], ['./winners.html', '수상작 도감', 'winners']] },
  { key: 'market', label: '장터', href: './market.html', subs: [['./market.html?type=home', '집', 'home'], ['./market.html?type=item', '물건', 'item'], ['./market.html?type=project', '프로젝트', 'project'], ['./market.html#hackathons', '해커톤']] },
  { key: 'jeju', label: '제주생활', href: './jeju.html', subs: [['./jeju.html#waste', '이거 어디 버려요?'], ['./jeju.html#sec-days', '요일별 배출'], ['./jeju.html#sec-stats', '배출 통계'], ['./jeju.html#sec-tips', '생활 꿀팁']] },
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
    <div class="meta"><span>${esc(oneLabel(p))}</span>${p.sample ? '<span class="badge sample">예시</span>' : ''}${p.origin && p.type === 'project' ? `<span>${esc(p.origin)}</span>` : ''}</div>
    <h3>${esc(p.name)}</h3><p class="tag">${esc(sub)}</p>
    <div class="foot"><span class="price">${esc(listPrice(p))}</span><span class="heart">추천 ${p.interest || 0}${p.comments ? ` · 댓글 ${p.comments}` : ''}</span></div>`;
  a.querySelector('.save').onclick = async (e) => { e.preventDefault(); e.stopPropagation(); if (localStorage.getItem('int-' + p.id)) return toast('이미 추천했어요'); try { const d = await api(`/api/projects/${p.id}/interest`, {}); localStorage.setItem('int-' + p.id, '1'); e.currentTarget.classList.add('on'); toast(`추천했어요 · ${d.interest}`); } catch (err) { toast(err.message); } };
  return a;
}
/* 피드형 카드 (홈 "새로 올라온 글") — 정사각 사진, 오버레이 추천, 올린 분, 한 줄, 반응 수 */
function photoCard(p) {
  const a = document.createElement('a'); a.className = 'pcard'; a.href = `./project.html?id=${encodeURIComponent(p.id)}`;
  const photo = (p.photos || [])[0];
  a.innerHTML = `<div class="pimg">${photo ? `<img src="${photo}" alt="" loading="lazy">` : `<div class="nophoto">${icon(TYPE_ICON[p.type] || 'puzzle')}</div>`}<span class="ptype">${esc(TYPE_LABEL[p.type] || '')}</span><button class="save" type="button" aria-label="추천">${icon('bookmark')}</button></div>
    <div class="pwho"><span class="avatar">${esc(initial(p.seller))}</span><span class="who">${esc(p.seller || '익명')}</span>${p.sample ? '<span class="badge sample">예시</span>' : ''}</div>
    <p class="ptext">${esc(p.name)} <span class="muted">${esc(p.tagline || '')}</span></p>
    <div class="pmeta"><span class="price">${esc(listPrice(p))}</span><span>추천 ${p.interest || 0} · 댓글 ${p.comments || 0}</span></div>`;
  a.querySelector('.save').onclick = async (e) => { e.preventDefault(); e.stopPropagation(); if (localStorage.getItem('int-' + p.id)) return toast('이미 추천했어요'); try { const d = await api(`/api/projects/${p.id}/interest`, {}); localStorage.setItem('int-' + p.id, '1'); e.currentTarget.classList.add('on'); toast(`추천했어요 · ${d.interest}`); } catch (err) { toast(err.message); } };
  return a;
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
function applyColors(c) { if (!c) return; const r = document.documentElement.style; if (c.accent) r.setProperty('--accent', c.accent); }

/* 배너 배경(캐러셀 1장용): 능선·바다·달·등불, 저채도 */
function bannerSVG() {
  const lanterns = Array.from({ length: 9 }, (_, i) => { const x = 80 + i * 140; const y = 30 + Math.sin(i * 1.3) * 5; return `<g class="lan" style="animation-delay:${(i % 4) * .5}s"><line x1="${x}" y1="${y - 10}" x2="${x}" y2="${y}" stroke="var(--ink-4)" stroke-width="1.5"/><g class="bulb"><ellipse cx="${x}" cy="${y + 9}" rx="7" ry="10" fill="var(--lan1)"/><path d="M${x - 7} ${y + 9} a7 10 0 0 0 14 0z" fill="var(--lan2)"/></g></g>`; }).join('');
  return `<svg class="banner-art" viewBox="0 0 1320 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient></defs><rect width="1320" height="300" fill="url(#sky)"/><circle cx="1150" cy="70" r="26" fill="var(--moon)"/><g class="stars" fill="#fff" opacity=".8"><circle cx="220" cy="50" r="1.2"/><circle cx="480" cy="30" r="1"/><circle cx="800" cy="46" r="1.3"/><circle cx="990" cy="24" r="1"/></g><path d="M0 210 L260 140 L420 170 L600 110 L720 90 L840 120 L1000 160 L1160 140 L1320 190 L1320 300 L0 300z" fill="var(--mtn1)"/><path d="M0 242 L180 205 L340 228 L520 196 L700 220 L880 192 L1060 224 L1220 202 L1320 234 L1320 300 L0 300z" fill="var(--mtn2)"/><rect y="266" width="1320" height="34" fill="var(--sea)"/><path d="M40 20 Q 660 2 1280 20" stroke="var(--ink-4)" stroke-width="1.5" fill="none"/>${lanterns}</svg>`;
}

/* ── 상단 · 보조 탭 · 하단 탭 · 푸터 ── */
async function mountShell({ active, primary, sub, banner = false } = {}) {
  CONFIG = await api('/api/config');
  const S = CONFIG.site;
  document.documentElement.dataset.theme = 'day'; applyColors(CONFIG.colors);
  if (!$('link[rel=icon]')) { const l = document.createElement('link'); l.rel = 'icon'; l.href = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#ff6b1a"/><path d="M30 72l14-28 12 10 14-20" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`; document.head.append(l); }
  for (const [k, v] of [['og:title', document.title], ['og:description', $('meta[name=description]')?.content || S.slogan], ['og:type', 'website'], ['og:site_name', S.name]]) { if (!$(`meta[property="${k}"]`)) { const m = document.createElement('meta'); m.setAttribute('property', k); m.content = v; document.head.append(m); } }

  const pkey = primary || ({ home: 'browse', winners: 'browse', market: 'market', jeju: 'jeju' }[active] || '');
  const header = document.createElement('header'); header.className = 'top';
  header.innerHTML = `<div class="wrap bar">
      <a class="logo" href="./"><span class="mark">${icon('run')}</span>${esc(S.name)}</a>
      <nav class="primary">${PRIMARY.map((p) => `<a href="${p.href}" class="${p.key === pkey ? 'on' : ''}">${p.label}</a>`).join('')}</nav>
      <form class="search" role="search" action="./search.html"><span class="sic">${icon('search')}</span><input name="q" placeholder="집, 물건, 프로젝트, 버리는 법 검색" autocomplete="off" aria-label="검색"></form>
      <div class="acts"><a class="btn write" href="./sell.html">${icon('plus')}<span>올리기</span></a></div>
    </div>`;
  document.body.prepend(header);
  // 보조 탭
  const P = PRIMARY.find((p) => p.key === pkey);
  if (P) {
    const bar = document.createElement('div'); bar.className = 'subnav';
    const here = location.pathname.split('/').pop() || 'index.html';
    bar.innerHTML = `<div class="wrap">${P.subs.map(([href, label, key]) => { const on = sub ? key === sub : (href.split('?')[0].split('#')[0].replace('./', '') || 'index.html') === here && !href.includes('?') && !href.includes('#'); return `<a href="${href}" class="${on ? 'on' : ''}">${label}</a>`; }).join('')}</div>`;
    header.after(bar);
  }
  if (banner) { const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = bannerSVG(); (document.querySelector('.subnav') || header).after(b); }

  // 모바일 하단 탭 (홈 · 장터 · 올리기 · 제주생활 · 도감)
  const tabs = document.createElement('nav'); tabs.className = 'tabbar';
  const t = [['./', 'home', '홈', 'home'], ['./market.html', 'grid', '장터', 'market'], ['./sell.html', 'plus', '올리기', 'sell'], ['./jeju.html', 'leaf', '제주생활', 'jeju'], ['./winners.html', 'trophy', '도감', 'winners']];
  tabs.innerHTML = t.map(([href, ic, label, key]) => `<a href="${href}" class="${key === 'sell' ? 'write' : ''} ${key === active ? 'on' : ''}">${icon(ic)}<span>${label}</span></a>`).join('');
  document.body.append(tabs);
  // 맨 위로
  const up = document.createElement('button'); up.className = 'totop'; up.setAttribute('aria-label', '맨 위로'); up.innerHTML = icon('up'); up.onclick = () => scrollTo({ top: 0, behavior: 'smooth' }); document.body.append(up);
  addEventListener('scroll', () => up.classList.toggle('show', scrollY > 600), { passive: true });

  // 광고: 넓은 화면은 좌우에 따라다니는 배너, 좁은 화면은 본문 끝 카드
  mountAds(CONFIG.ads);
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap"><div><b>${esc(S.name)}</b> · ${esc(S.slogan)}<br><span class="small">${esc(CONFIG.footer?.note || '')}</span></div><div class="links"><a href="${esc(S.threads)}" target="_blank" rel="noopener">스레드</a><a href="${esc(S.openchat)}">오픈채팅</a><a href="./admin.html">관리자</a></div></div>`;
  document.body.append(footer);
  return CONFIG;
}

/* 광고 배너 (디자인은 코드로 그림: 청록/주황 테마, 아이콘 패턴, 노트북 청년) */
function adArt(theme) {
  const c = theme === 'orange' ? ['#ff8a3d', '#ffb074', '#fff1e8'] : ['#1fa3b3', '#4fc3d0', '#e6f7f9'];
  const icons = ['M2 7h16M2 12h12M2 17h8', 'M10 2v16M2 10h16', 'M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14', 'M3 15l5-6 4 4 5-7', 'M4 4h12v12H4z', 'M10 2l2.4 5 5.6.8-4 3.9.9 5.6L10 14.6 5.1 17.3l.9-5.6-4-3.9 5.6-.8z'];
  const pattern = Array.from({ length: 18 }, (_, i) => { const x = 14 + (i % 3) * 52 + (Math.floor(i / 3) % 2) * 20, y = 24 + Math.floor(i / 3) * 44; return `<g transform="translate(${x} ${y}) scale(.9)" stroke="#fff" stroke-opacity=".35" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="${icons[i % icons.length]}"/></g>`; }).join('');
  return `<svg viewBox="0 0 160 300" class="adart" aria-hidden="true"><defs><linearGradient id="adg-${theme}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect width="160" height="300" fill="url(#adg-${theme})"/>${pattern}
    <ellipse cx="80" cy="300" rx="110" ry="60" fill="${c[2]}" opacity=".95"/>
    <g transform="translate(80 236)"><circle cx="0" cy="-34" r="16" fill="#f6d7bd"/><path d="M-16 -40 q16 -18 32 0 v-6 q-16 -14 -32 0z" fill="#2b2b2b"/><path d="M-26 6 q0 -26 26 -26 q26 0 26 26z" fill="${c[0]}"/><rect x="-30" y="2" width="60" height="6" rx="3" fill="#333"/><rect x="-28" y="-14" width="56" height="18" rx="3" fill="#fff" stroke="#333" stroke-width="2"/></g></svg>`;
}
function adCard(ad, side) {
  const a = document.createElement('a'); a.className = `ad ${ad.theme || 'teal'} ${side}`; a.href = ad.href || '#'; a.target = '_blank'; a.rel = 'noopener sponsored';
  a.innerHTML = `${adArt(ad.theme)}<span class="adlabel">${esc(ad.label || '광고')}</span><div class="adtext"><p class="kicker">${esc(ad.kicker || '')}</p><h3>${rich(ad.title || '')}</h3><p class="sub">${esc(ad.sub || '')}</p><span class="btn sm">${esc(ad.cta || '자세히')}</span></div>`;
  return a;
}
function mountAds(ads) {
  if (!ads || ads.enabled === false) return;
  const wrap = document.createElement('div'); wrap.className = 'ads';
  if (ads.left?.title) wrap.append(adCard(ads.left, 'left'));
  if (ads.right?.title) wrap.append(adCard(ads.right, 'right'));
  document.body.append(wrap);
  // 좁은 화면: 본문 끝에 가로 카드로
  const main = document.querySelector('main'); if (!main) return;
  const inline = document.createElement('div'); inline.className = 'ads-inline';
  if (ads.left?.title) inline.append(adCard(ads.left, 'inline')); if (ads.right?.title) inline.append(adCard(ads.right, 'inline'));
  main.append(inline);
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
