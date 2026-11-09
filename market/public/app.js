/* 바톤 공통 틀: 테마(낮/밤), 상단 메뉴, 제주 야시장 배너, 푸터, 공용 도우미
   ─ 색·문구를 바꾸려면 아래 CONFIG와 style.css 맨 위 변수만 고치면 됩니다. */
const CONFIG = {
  name: '바톤',
  slogan: '해커톤의 바통을 다음 주자에게',
  threads: 'https://www.threads.net/',   // 스레드 계정 주소로 바꾸세요
  openchat: '#',                         // 카카오 오픈채팅 링크로 바꾸세요
  nav: [
    { href: './', label: '홈', key: 'home' },
    { href: './#projects', label: '장터', key: 'market' },
    { href: './winners.html', label: '수상작 도감', key: 'winners', badge: 'NEW' },
    { href: './#hackathons', label: '해커톤 일정', key: 'hackathons' },
    { href: './sell.html', label: '판매 등록', key: 'sell', badge: 'AI' },
  ],
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const won = (n) => (n ? Number(n).toLocaleString('ko-KR') + '원' : '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STAGE = { idea: '아이디어', demo: '데모', users: '사용자 있음', revenue: '매출 있음' };
async function api(path, opts) {
  const r = await fetch(path, opts && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
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

/* ── 테마: 18시~06시는 밤(야시장), 버튼으로 바꾸면 기억 ── */
function initTheme() {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  if (!t) { const h = new Date().getHours(); t = h >= 18 || h < 6 ? 'night' : 'day'; }
  document.documentElement.dataset.theme = t;
}
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
  document.documentElement.dataset.theme = t; try { localStorage.setItem('theme', t); } catch {}
  $$('.themeBtn').forEach((b) => (b.textContent = t === 'night' ? '☀️ 낮' : '🏮 밤'));
}

/* ── 제주 야시장 배너 (코드로 그린 그림, 이미지 파일 없음) ── */
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

/* ── 상단 메뉴 · 배너 · 푸터 삽입 ── */
function mountShell({ active, banner = true }) {
  initTheme();
  const isNight = document.documentElement.dataset.theme === 'night';
  const nav = CONFIG.nav.map((n) => `<a href="${n.href}" class="${n.key === active ? 'on' : ''}">${n.label}${n.badge ? `<i class="nb">${n.badge}</i>` : ''}</a>`).join('');
  const header = document.createElement('header'); header.className = 'top';
  header.innerHTML = `<div class="wrap"><a class="logo" href="./"><span class="mark">🏃</span>${CONFIG.name}</a><nav>${nav}</nav><button class="themeBtn" aria-label="테마 바꾸기">${isNight ? '☀️ 낮' : '🏮 밤'}</button></div>`;
  header.querySelector('.themeBtn').onclick = toggleTheme;
  document.body.prepend(header);
  if (banner) {
    const b = document.createElement('div'); b.className = 'banner';
    b.innerHTML = bannerSVG() + `<div class="wrap banner-text"><p class="kicker">🍊 제주에서 시작한 프로젝트 장터</p><h1>해커톤이 끝나도<br>프로젝트는 <em>끝나지 않게</em></h1><p class="sub">AI로 만든 서비스와 해커톤 결과물을 이어갈 <b>다음 주인</b>에게 넘기는 곳. 주소 하나면 AI가 30초 만에 판매 글을 써 드려요.</p><div class="cta"><a class="btn primary big" href="./sell.html">🏃 내 프로젝트 넘기기</a><button class="btn big ghost" id="wantBtn">👀 사고 싶어요 알림</button></div></div>`;
    header.after(b);
  }
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap"><div><b>🏃 ${CONFIG.name}</b> · ${CONFIG.slogan}<br><small>해커톤 일정 출처: Devpost 공개 API · 수상작 도감 출처: Devpost · "예시" 표시 프로젝트는 시연용 가상 데이터예요</small></div><div class="links"><a class="btn" href="${CONFIG.threads}" target="_blank" rel="noopener">🧵 스레드 팔로우</a><a class="btn" href="${CONFIG.openchat}">💬 오픈채팅</a></div></div>`;
  document.body.append(footer);
  // 관심 등록 모달 (배너 버튼용)
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
}
