/* 바톤 공통 틀: 설정(config.json) 읽기 → 테마 · 상단 메뉴 · 배너 · 푸터 그리기
   문구·색·메뉴는 /admin.html 에서 고치세요. 코드를 만질 일은 레이아웃을 바꿀 때뿐입니다. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const won = (n) => (n ? Number(n).toLocaleString('ko-KR') + '원' : '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 설정 문구의 [강조]를 색 글자로, 줄바꿈(\n)을 <br>로
const rich = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<em>$1</em>').replace(/\n/g, '<br>');
const STAGE = { idea: '아이디어', demo: '데모', users: '사용자 있음', revenue: '매출 있음' };
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
    b.innerHTML = bannerSVG() + `<div class="wrap banner-text"><p class="kicker">${esc(B.kicker)}</p><h1>${rich(B.title)}</h1><p class="sub">${rich(B.sub).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>')}</p><div class="cta"><a class="btn primary big" href="./sell.html">${esc(B.primaryLabel)}</a><button class="btn big ghost" id="wantBtn">${esc(B.secondaryLabel)}</button></div></div>`;
    header.after(b);
  }
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap"><div><b>🏃 ${esc(S.name)}</b> · ${esc(S.slogan)}<br><small>${esc(CONFIG.footer?.note || '')}</small></div><div class="links"><a class="btn" href="${esc(S.threads)}" target="_blank" rel="noopener">🧵 스레드 팔로우</a><a class="btn" href="${esc(S.openchat)}">💬 오픈채팅</a><a class="btn" href="./admin.html" style="opacity:.6">⚙️</a></div></div>`;
  document.body.append(footer);
  if (banner) {
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'wantModal';
    m.innerHTML = `<form class="form" id="wantForm"><h3>알림 받기</h3><p class="note">새 프로젝트가 올라오거나 장터가 정식으로 열리면 알려드려요.</p>
      <label>나는<select name="role"><option value="buy">사고 싶어요 (프로젝트를 이어가고 싶어요)</option><option value="sell">팔고 싶어요 (넘길 프로젝트가 있어요)</option><option value="both">둘 다요</option></select></label>
      <label>연락처 (이메일 또는 스레드 아이디)<input name="contact" required placeholder="you@example.com 또는 @threads_id"></label>
      <label>찾는 것 (선택)<input name="note" placeholder="예: 사용자 있는 교육 서비스, 100만 원 이하"></label>
      <div class="actions"><button type="button" class="btn" data-close>닫기</button><button class="btn primary">등록</button></div></form>`;
    document.body.append(m);
    $('#wantBtn').onclick = () => m.classList.add('show');
    m.querySelector('[data-close]').onclick = () => m.classList.remove('show');
    m.onclick = (e) => { if (e.target === m) m.classList.remove('show'); };
    $('#wantForm').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/waitlist', Object.fromEntries(new FormData(e.target))); m.classList.remove('show'); e.target.reset(); toast('등록됐어요! 새 소식을 보내드릴게요 🙌'); document.dispatchEvent(new Event('stats:refresh')); } catch (err) { toast(err.message); } };
  }
  return CONFIG;
}
