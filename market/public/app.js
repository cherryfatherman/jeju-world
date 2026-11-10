/* 바톤 공통 틀 v2: 설정(config.json) → 테마 · 상단 · 히어로 · 푸터 · 공용 도우미
   문구·메뉴는 /admin.html 에서 고친다. 디자인 원칙: docs/design/principles.md */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<em>$1</em>').replace(/\n/g, '<br>');
const STAGE = { idea: '아이디어', demo: '데모', users: '사용자 있음', revenue: '매출 있음' };
const TYPE_LABEL = { home: '집', item: '물건', project: '프로젝트' };
const TYPE_ICON = { home: 'home', item: 'box', project: 'puzzle' };
let CONFIG = null;

// 금액: "300만 원", "1만 5천 원", "9,000원"
const won = (n) => {
  n = Number(n) || 0; if (!n) return '';
  if (n >= 100000000) { const eok = Math.floor(n / 100000000), man = Math.round((n % 100000000) / 10000); return `${eok}억${man ? ` ${man.toLocaleString('ko-KR')}만` : ''} 원`; }
  if (n >= 10000) { const man = Math.floor(n / 10000), rest = n % 10000; return `${man.toLocaleString('ko-KR')}만${rest ? ` ${rest >= 1000 && rest % 1000 === 0 ? rest / 1000 + '천' : rest.toLocaleString('ko-KR')}` : ''} 원`; }
  return n.toLocaleString('ko-KR') + '원';
};

/* ── 선 아이콘 세트 (20px, 1.75px) ── */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  box: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>',
  puzzle: '<path d="M10 3h4v3a2 2 0 1 0 4 0h3v4h-3a2 2 0 1 0 0 4h3v4h-4v-3a2 2 0 1 0-4 0v3H6v-4H3v-4h3V7h4z"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 21h8M9 17h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.3 2A3.5 3.5 0 0 1 17 18z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12M8 7l4-4 4 4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2 2 4"/><path d="M11 15l1-5-3 1-2 3"/><path d="M12 10l3 1 3-2"/>',
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
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
// 카드마다 라벨 하나만
function oneLabel(p) {
  if (p.type === 'home') return p.home?.deal && p.home.deal !== '미정' ? p.home.deal : '집';
  if (p.type === 'item') return p.condition || p.category || '물건';
  return STAGE[p.stage] || '프로젝트';
}
function listingCard(p) {
  const a = document.createElement('a'); a.className = 'card'; a.href = `./project.html?id=${encodeURIComponent(p.id)}`;
  const photo = (p.photos || [])[0];
  let sub = p.tagline || '';
  if (p.type === 'home' && p.home) { const h = p.home; sub = [h.dong, h.areaM2 ? `${h.areaM2}㎡ · ${(h.areaM2 / 3.3058).toFixed(0)}평` : '', h.rooms, h.floor].filter(Boolean).join(' · ') || sub; }
  const price = p.type === 'home' ? homePrice(p.home) : priceText(p);
  a.innerHTML = `${photo ? `<img class="photo" src="${photo}" alt="" loading="lazy">` : `<div class="nophoto">${icon(TYPE_ICON[p.type] || 'puzzle')}</div>`}
    <div class="meta"><span class="badge">${esc(oneLabel(p))}</span>${p.sample ? '<span class="badge sample">예시</span>' : ''}${p.origin && p.type === 'project' ? `<span class="muted">${esc(p.origin)}</span>` : ''}</div>
    <h3>${esc(p.name)}</h3><p class="tag">${esc(sub)}</p>
    <div class="foot"><span class="price">${esc(price)}</span><span class="heart">${icon('heart', 'ic')} ${p.interest || 0}${p.comments ? ` · 댓글 ${p.comments}` : ''}</span></div>`;
  a.querySelector('.heart svg').style.cssText = 'width:14px;height:14px;vertical-align:-2px';
  return a;
}

/* ── 오늘의 제주어 ── */
const JEJU_WORDS = [['혼저옵서예', '어서 오세요'], ['폭삭 속았수다', '정말 수고하셨습니다'], ['맨도롱 또똣', '따뜻하게, 알맞게 따끈한'], ['감수광', '가십니까?'], ['왕 봥 갑서', '와서 보고 가세요'], ['고맙수다', '고맙습니다'], ['놀멍 쉬멍', '놀면서 쉬면서'], ['도르멍', '빨리, 서둘러서'], ['하영', '많이'], ['지꺼지다', '기쁘다, 신나다'], ['소랑햄수다', '사랑합니다'], ['또시 봅주', '다시 봐요'], ['무사', '왜'], ['어떵 살암수과', '어떻게 지내세요?'], ['촘말로', '정말로']];
const todaysWord = () => JEJU_WORDS[Math.floor(Date.now() / 86400000) % JEJU_WORDS.length];

function countUp(el, to, ms = 800) {
  const start = performance.now();
  const step = (t) => { const k = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString('ko-KR'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
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

/* ── 테마 ── */
function initTheme(defaultTheme) {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  if (!t) { if (defaultTheme === 'day' || defaultTheme === 'night') t = defaultTheme; else { const h = new Date().getHours(); t = h >= 18 || h < 6 ? 'night' : 'day'; } }
  document.documentElement.dataset.theme = t;
}
function themeIcon() { return document.documentElement.dataset.theme === 'night' ? icon('sun') : icon('moon'); }
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
  document.documentElement.dataset.theme = t; try { localStorage.setItem('theme', t); } catch {}
  $$('.themeBtn').forEach((b) => (b.innerHTML = themeIcon()));
}
function applyColors(c) { if (!c) return; const r = document.documentElement.style; if (c.accent) r.setProperty('--accent', c.accent); }

/* ── 히어로 배경: 한라산 능선 · 바다 · 달 · 등불 한 줄 (저채도, 글 뒤로 물러남) ── */
function bannerSVG() {
  const lanterns = Array.from({ length: 11 }, (_, i) => { const x = 60 + i * 120; const y = 34 + Math.sin(i * 1.3) * 6; return `<g class="lan" style="animation-delay:${(i % 4) * .5}s"><line x1="${x}" y1="${y - 12}" x2="${x}" y2="${y}" stroke="var(--ink-4)" stroke-width="1.5"/><g class="bulb"><ellipse cx="${x}" cy="${y + 10}" rx="8" ry="11" fill="var(--lan1)"/><path d="M${x - 8} ${y + 10} a8 11 0 0 0 16 0z" fill="var(--lan2)"/></g></g>`; }).join('');
  return `<svg class="banner-art" viewBox="0 0 1320 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient></defs>
  <rect width="1320" height="320" fill="url(#sky)"/>
  <circle cx="1150" cy="80" r="30" fill="var(--moon)"/>
  <g class="stars" fill="#fff" opacity=".8"><circle cx="220" cy="50" r="1.2"/><circle cx="480" cy="30" r="1"/><circle cx="800" cy="46" r="1.3"/><circle cx="990" cy="24" r="1"/><circle cx="1280" cy="60" r="1.1"/></g>
  <path d="M0 230 L260 150 L420 185 L600 120 L720 96 L840 130 L1000 170 L1160 150 L1320 200 L1320 320 L0 320z" fill="var(--mtn1)"/>
  <path d="M0 262 L180 220 L340 245 L520 210 L700 236 L880 206 L1060 240 L1220 216 L1320 250 L1320 320 L0 320z" fill="var(--mtn2)"/>
  <rect y="284" width="1320" height="36" fill="var(--sea)"/>
  <path d="M30 22 Q 660 2 1290 22" stroke="var(--ink-4)" stroke-width="1.5" fill="none"/>
  ${lanterns}
</svg>`;
}

/* ── 상단 · 히어로 · 푸터 ── */
async function mountShell({ active, banner = true } = {}) {
  CONFIG = await api('/api/config');
  const S = CONFIG.site, B = CONFIG.banner;
  initTheme(S.defaultTheme); applyColors(CONFIG.colors);
  if (!$('link[rel=icon]')) { const l = document.createElement('link'); l.rel = 'icon'; l.href = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#ff6b1a"/><path d="M30 72l14-28 12 10 14-20" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`; document.head.append(l); }
  for (const [k, v] of [['og:title', document.title], ['og:description', $('meta[name=description]')?.content || S.slogan], ['og:type', 'website'], ['og:site_name', S.name]]) { if (!$(`meta[property="${k}"]`)) { const m = document.createElement('meta'); m.setAttribute('property', k); m.content = v; document.head.append(m); } }

  const nav = (CONFIG.nav || []).map((n) => `<a href="${esc(n.href)}" class="${n.key === active ? 'on' : ''}">${esc(n.label)}</a>`).join('');
  const header = document.createElement('header'); header.className = 'top';
  header.innerHTML = `<div class="wrap"><a class="logo" href="./"><span class="mark">${icon('run')}</span>${esc(S.name)}</a><nav>${nav}</nav><button class="themeBtn" aria-label="낮·밤 바꾸기" title="낮·밤 바꾸기">${themeIcon()}</button></div>`;
  header.querySelector('.themeBtn').onclick = toggleTheme;
  document.body.prepend(header);

  if (banner) {
    const b = document.createElement('div'); b.className = 'banner';
    b.innerHTML = bannerSVG() + `<div class="wrap banner-text"><p class="kicker">${esc(B.kicker)}</p><h1>${rich(B.title)}</h1><p class="sub">${rich(B.sub).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>')}</p>
      <div class="cta"><a class="btn primary big" href="./sell.html">${esc(B.primaryLabel)}</a><button class="textlink" id="wantBtn">${esc(B.secondaryLabel)} ${icon('arrow')}</button></div>
      <button class="word" id="jejuWord" title="오늘의 제주어">${icon('speak')} 오늘의 제주어 <b>${esc(todaysWord()[0])}</b></button></div>`;
    header.after(b);
    $('#jejuWord').onclick = (e) => { const [w, m] = todaysWord(); e.currentTarget.innerHTML = `${icon('speak')} <b>${esc(w)}</b> &nbsp;${esc(m)}`; };
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'wantModal';
    m.innerHTML = `<form class="form" id="wantForm"><h3>새 글 알림 받기</h3><p class="note">원하는 글이 올라오면 알려드려요. 스팸은 보내지 않아요.</p>
      <label>나는<select name="role"><option value="buy">찾고 있어요 (집·물건·프로젝트)</option><option value="sell">내놓을 게 있어요</option><option value="both">둘 다요</option></select></label>
      <label>연락처 (이메일 또는 스레드 아이디)<input name="contact" required placeholder="you@example.com 또는 @threads_id"></label>
      <label>찾는 것 (선택)<input name="note" placeholder="예: 아라동 원룸 월 40 이하 / 중고 자전거"></label>
      <div class="actions"><button type="button" class="btn" data-close>닫기</button><button class="btn primary">알림 받기</button></div></form>`;
    document.body.append(m);
    $('#wantBtn').onclick = () => m.classList.add('show');
    m.querySelector('[data-close]').onclick = () => m.classList.remove('show');
    m.onclick = (e) => { if (e.target === m) m.classList.remove('show'); };
    $('#wantForm').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/waitlist', Object.fromEntries(new FormData(e.target))); m.classList.remove('show'); e.target.reset(); toast('알림을 신청했어요'); document.dispatchEvent(new Event('stats:refresh')); } catch (err) { toast(err.message); } };
  }
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap"><div><b>${esc(S.name)}</b> · ${esc(S.slogan)}<br><span class="small">${esc(CONFIG.footer?.note || '')}</span></div><div class="links"><a href="${esc(S.threads)}" target="_blank" rel="noopener">스레드</a><a href="${esc(S.openchat)}">오픈채팅</a><a href="./admin.html">관리자</a></div></div>`;
  document.body.append(footer);
  return CONFIG;
}
