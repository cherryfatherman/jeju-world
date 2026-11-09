/* 바톤 공통 틀: 설정(config.json) 읽기 → 테마 · 상단 메뉴 · 배너 · 푸터 그리기
   문구·색·메뉴는 /admin.html 에서 고치세요. 코드를 만질 일은 레이아웃을 바꿀 때뿐입니다. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
// 금액: 한국식 "300만 원", "1만 5천 원", "9,000원"
const won = (n) => {
  n = Number(n) || 0; if (!n) return '';
  if (n >= 100000000) { const eok = Math.floor(n / 100000000), man = Math.round((n % 100000000) / 10000); return `${eok}억${man ? ` ${man.toLocaleString('ko-KR')}만` : ''} 원`; }
  if (n >= 10000) { const man = Math.floor(n / 10000), rest = n % 10000; return `${man.toLocaleString('ko-KR')}만${rest ? ` ${rest >= 1000 && rest % 1000 === 0 ? rest / 1000 + '천' : rest.toLocaleString('ko-KR')}` : ''} 원`; }
  return n.toLocaleString('ko-KR') + '원';
};
// 오늘의 제주어 (매일 하나)
const JEJU_WORDS = [
  ['혼저옵서예', '어서 오세요'], ['폭삭 속았수다', '정말 수고하셨습니다'], ['맨도롱 또똣', '따뜻하게, 알맞게 따끈한'], ['감수광', '가십니까?'], ['왕 봥 갑서', '와서 보고 가세요'],
  ['고맙수다', '고맙습니다'], ['놀멍 쉬멍', '놀면서 쉬면서'], ['도르멍', '빨리, 서둘러서'], ['하영', '많이'], ['지꺼지다', '기쁘다, 신나다'],
  ['소랑햄수다', '사랑합니다'], ['또시 봅주', '다시 봐요'], ['무사', '왜'], ['어떵 살암수과', '어떻게 지내세요?'], ['촘말로', '정말로'],
];
const todaysWord = () => JEJU_WORDS[Math.floor((Date.now() / 86400000)) % JEJU_WORDS.length];
// 숫자가 올라가는 효과
function countUp(el, to, ms = 900) {
  const start = performance.now(); const from = 0;
  const step = (t) => { const k = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e).toLocaleString('ko-KR'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// 🍊 축하 효과 (글 올리기 성공 등)
function confetti(n = 36) {
  const wrap = document.createElement('div'); wrap.className = 'confetti'; document.body.append(wrap);
  for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.textContent = ['🍊', '🏮', '✨', '🌊', '🍊'][i % 5]; s.style.left = Math.random() * 100 + 'vw'; s.style.animationDelay = Math.random() * .6 + 's'; s.style.fontSize = 14 + Math.random() * 18 + 'px'; wrap.append(s); }
  setTimeout(() => wrap.remove(), 3200);
}
// 공유 (휴대폰은 공유창, PC는 링크 복사)
async function share(title, text, url = location.href) {
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요 🔗'); } catch { prompt('링크를 복사하세요', url); }
}
// 방문 집계 (개인정보 없음)
try { fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: location.pathname.split('/').pop() || 'index.html' }) }); } catch {}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 설정 문구의 [강조]를 색 글자로, 줄바꿈(\n)을 <br>로
const rich = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<em>$1</em>').replace(/\n/g, '<br>');
const STAGE = { idea: '아이디어', demo: '데모', users: '사용자 있음', revenue: '매출 있음' };
const TYPE_ICON = { home: '🏠', item: '📦', project: '🧩' };
const TYPE_LABEL = { home: '집', item: '물건', project: '프로젝트' };
// 장터 카드 (집·물건·프로젝트 공통)
function listingCard(p) {
  const a = document.createElement('a'); a.className = 'card'; a.href = `./project.html?id=${encodeURIComponent(p.id)}`;
  const photo = (p.photos || [])[0];
  let price = '', facts = '';
  if (p.type === 'home' && p.home) {
    const h = p.home;
    price = h.deal === '매매' || h.deal === '전세' ? `${h.deal} ${h.deposit ? won(h.deposit) : '협의'}` : h.monthly ? `${h.deposit ? won(h.deposit) + ' / ' : ''}월 ${won(h.monthly)}` : '가격 협의';
    facts = `<div class="facts-mini">${h.areaM2 ? `<span><b>${h.areaM2}㎡</b> ≈${(h.areaM2 / 3.3058).toFixed(0)}평</span>` : ''}${h.rooms ? `<span>${esc(h.rooms)}</span>` : ''}${h.floor ? `<span>${esc(h.floor)}</span>` : ''}${h.dong ? `<span>📍 ${esc(h.dong)}</span>` : ''}</div>`;
  } else if (p.type === 'item') {
    price = p.priceMax ? (p.priceMin && p.priceMin !== p.priceMax ? `${won(p.priceMin)} ~ ${won(p.priceMax)}` : won(p.priceMax)) : '가격 협의';
  } else price = priceText(p);
  a.innerHTML = `${photo ? `<img class="photo" src="${photo}" alt="">` : `<div class="nophoto">${TYPE_ICON[p.type] || '🧩'}</div>`}
    <div class="meta"><span class="badge">${TYPE_ICON[p.type] || ''} ${TYPE_LABEL[p.type] || ''}</span>${p.type === 'project' ? `<span class="badge stage-${esc(p.stage)}">${STAGE[p.stage] || ''}</span>` : ''}${p.category && p.category !== TYPE_LABEL[p.type] ? `<span class="badge">${esc(p.category)}</span>` : ''}${p.condition ? `<span class="badge">${esc(p.condition)}</span>` : ''}${p.sample ? '<span class="badge sample">예시</span>' : ''}</div>
    <h3>${esc(p.name)}</h3><p class="tag">${esc(p.tagline)}</p>${facts}
    <div class="foot"><span class="price">${esc(price)}</span><span class="heart">♥ ${p.interest || 0}${p.comments ? ` · 💬 ${p.comments}` : ''}${p.origin ? ` · ${esc(p.origin)}` : ''}</span></div>`;
  return a;
}
let CONFIG = null;

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
  el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2500);
}
function priceText(p) {
  if (p.dealType === 'cofounder') return '공동창업자 구함';
  if (p.dealType === 'open') return '오픈소스 · 후원';
  if (!p.priceMax) return '가격 협의';
  return p.priceMin ? `${won(p.priceMin)} ~ ${won(p.priceMax)}` : `~ ${won(p.priceMax)}`;
}

/* ── 테마 ── */
function initTheme(defaultTheme) {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  if (!t) { if (defaultTheme === 'day' || defaultTheme === 'night') t = defaultTheme; else { const h = new Date().getHours(); t = h >= 18 || h < 6 ? 'night' : 'day'; } }
  document.documentElement.dataset.theme = t;
}
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
  document.documentElement.dataset.theme = t; try { localStorage.setItem('theme', t); } catch {}
  $$('.themeBtn').forEach((b) => (b.textContent = t === 'night' ? '☀️ 낮' : '🏮 밤'));
}
function applyColors(c) {
  if (!c) return; const r = document.documentElement.style;
  if (c.accent) r.setProperty('--accent', c.accent); if (c.accent2) r.setProperty('--accent2', c.accent2);
}

/* ── 제주 야시장 배너 (코드로 그린 그림) ── */
function bannerSVG() {
  const lanterns = Array.from({ length: 14 }, (_, i) => { const x = 40 + i * 92; const y = 46 + Math.sin(i * 1.1) * 10; return `<g class="lan" style="animation-delay:${(i % 5) * .4}s"><line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y}" stroke="#5a3a2a" stroke-width="2"/><ellipse cx="${x}" cy="${y + 12}" rx="11" ry="14" fill="var(--lan1)"/><path d="M${x - 11} ${y + 12} a11 14 0 0 0 22 0z" fill="var(--lan2)"/><ellipse cx="${x}" cy="${y + 10}" rx="4" ry="6" fill="#fff5d6" opacity=".9"/></g>`; }).join('');
  const stalls = [120, 330, 560, 820, 1060].map((x, i) => `<g><path d="M${x - 70} 198 L${x} 150 L${x + 70} 198z" fill="${i % 2 ? 'var(--roof1)' : 'var(--roof2)'}"/><rect x="${x - 56}" y="198" width="112" height="46" fill="var(--stall)"/><rect x="${x - 44}" y="212" width="88" height="18" rx="4" fill="var(--sign)"/><rect x="${x - 60}" y="196" width="6" height="52" fill="#4a3426"/><rect x="${x + 54}" y="196" width="6" height="52" fill="#4a3426"/></g>`).join('');
  return `<svg class="banner-art" viewBox="0 0 1320 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="var(--moonglow)" stop-opacity=".9"/><stop offset="1" stop-color="var(--moonglow)" stop-opacity="0"/></radialGradient></defs>
  <rect width="1320" height="260" fill="url(#sky)"/>
  <circle cx="1120" cy="70" r="90" fill="url(#glow)"/><circle cx="1120" cy="70" r="34" fill="var(--moon)"/>
  <g class="stars" fill="#fff"><circle cx="200" cy="40" r="1.5"/><circle cx="420" cy="22" r="1.2"/><circle cx="760" cy="36" r="1.6"/><circle cx="950" cy="18" r="1.1"/><circle cx="1280" cy="48" r="1.4"/><circle cx="600" cy="60" r="1"/></g>
  <path d="M0 190 L220 118 L380 150 L560 96 L660 70 L760 96 L900 136 L1060 112 L1320 170 L1320 260 L0 260z" fill="var(--mtn1)"/>
  <path d="M0 215 L160 170 L300 196 L470 160 L620 182 L800 158 L980 190 L1150 166 L1320 206 L1320 260 L0 260z" fill="var(--mtn2)"/>
  <path class="sea" d="M0 232 Q 60 224 120 232 T 240 232 T 360 232 T 480 232 T 600 232 T 720 232 T 840 232 T 960 232 T 1080 232 T 1200 232 T 1320 232 L1320 260 L0 260z" fill="var(--sea)"/>
  <rect y="244" width="1320" height="16" fill="var(--ground)"/>
  ${stalls}
  <g><rect x="1230" y="196" width="28" height="36" rx="8" fill="#555"/><circle cx="1244" cy="188" r="14" fill="#555"/><rect x="1236" y="172" width="16" height="8" rx="3" fill="#444"/><circle cx="1239" cy="186" r="2" fill="#222"/><circle cx="1249" cy="186" r="2" fill="#222"/></g>
  <path d="M20 30 Q 660 10 1300 30" stroke="#5a3a2a" stroke-width="2" fill="none"/>
  ${lanterns}
</svg>`;
}

/* ── 상단 메뉴 · 배너 · 푸터 삽입 (설정을 읽은 뒤) ── */
async function mountShell({ active, banner = true } = {}) {
  CONFIG = await api('/api/config');
  // 파비콘(이모지) + 공유 미리보기 메타
  if (!$('link[rel=icon]')) { const l = document.createElement('link'); l.rel = 'icon'; l.href = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#ff7a1a"/><text y="72" x="50" text-anchor="middle" font-size="60">🏃</text></svg>')}`; document.head.append(l); }
  for (const [k, v] of [['og:title', document.title], ['og:description', $('meta[name=description]')?.content || CONFIG.site.slogan], ['og:type', 'website'], ['og:site_name', CONFIG.site.name]]) { if (!$(`meta[property="${k}"]`)) { const m = document.createElement('meta'); m.setAttribute('property', k); m.content = v; document.head.append(m); } }
  const S = CONFIG.site, B = CONFIG.banner;
  initTheme(S.defaultTheme); applyColors(CONFIG.colors);
  document.title = document.title.replace('바톤', S.name);
  const isNight = document.documentElement.dataset.theme === 'night';
  const nav = (CONFIG.nav || []).map((n) => `<a href="${esc(n.href)}" class="${n.key === active ? 'on' : ''}">${esc(n.label)}${n.badge ? `<i class="nb">${esc(n.badge)}</i>` : ''}</a>`).join('');
  const header = document.createElement('header'); header.className = 'top';
  header.innerHTML = `<div class="wrap"><a class="logo" href="./"><span class="mark">🏃</span>${esc(S.name)}</a><nav>${nav}</nav><button class="themeBtn" aria-label="테마 바꾸기">${isNight ? '☀️ 낮' : '🏮 밤'}</button></div>`;
  header.querySelector('.themeBtn').onclick = toggleTheme;
  document.body.prepend(header);
  if (banner) {
    const b = document.createElement('div'); b.className = 'banner';
    b.innerHTML = bannerSVG() + `<div class="wrap banner-text"><p class="kicker">${esc(B.kicker)}</p><h1>${rich(B.title)}</h1><p class="sub">${rich(B.sub).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>')}</p><div class="cta"><a class="btn primary big" href="./sell.html">${esc(B.primaryLabel)}</a><button class="btn big ghost" id="wantBtn">${esc(B.secondaryLabel)}</button></div><button class="word" id="jejuWord" title="오늘의 제주어 · 누르면 뜻이 보여요">🗣️ 오늘의 제주어 <b>${esc(todaysWord()[0])}</b></button></div>`;
    header.after(b);
    $('#jejuWord').onclick = (e) => { const [w, m] = todaysWord(); e.currentTarget.innerHTML = `🗣️ <b>${esc(w)}</b> = ${esc(m)}`; e.currentTarget.classList.add('open'); };
  }
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap"><div><b>🏃 ${esc(S.name)}</b> · ${esc(S.slogan)}<br><small>${esc(CONFIG.footer?.note || '')}</small></div><div class="links"><a class="btn" href="${esc(S.threads)}" target="_blank" rel="noopener">🧵 스레드 팔로우</a><a class="btn" href="${esc(S.openchat)}">💬 오픈채팅</a><a class="btn" href="./admin.html" style="opacity:.6" title="관리자">⚙️ 관리자</a></div></div>`;
  document.body.append(footer);
  if (banner) {
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'wantModal';
    m.innerHTML = `<form class="form" id="wantForm"><h3>알림 받기</h3><p class="note">새 글이 올라오거나 바톤이 정식으로 열리면 알려드려요. 스팸은 안 보내요.</p>
      <label>나는<select name="role"><option value="buy">찾고 있어요 (집·물건·프로젝트)</option><option value="sell">내놓을 게 있어요</option><option value="both">둘 다요</option></select></label>
      <label>연락처 (이메일 또는 스레드 아이디)<input name="contact" required placeholder="you@example.com 또는 @threads_id"></label>
      <label>찾는 것 (선택)<input name="note" placeholder="예: 아라동 원룸 월 40 이하 / 중고 자전거"></label>
      <div class="actions"><button type="button" class="btn" data-close>닫기</button><button class="btn primary">등록</button></div></form>`;
    document.body.append(m);
    $('#wantBtn').onclick = () => m.classList.add('show');
    m.querySelector('[data-close]').onclick = () => m.classList.remove('show');
    m.onclick = (e) => { if (e.target === m) m.classList.remove('show'); };
    $('#wantForm').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/waitlist', Object.fromEntries(new FormData(e.target))); m.classList.remove('show'); e.target.reset(); toast('등록됐어요! 새 소식을 보내드릴게요 🙌'); document.dispatchEvent(new Event('stats:refresh')); } catch (err) { toast(err.message); } };
  }
  return CONFIG;
}
