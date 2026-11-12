// 섬업 레터: 매일 아침 한 번, 사이트에 올라온 글로 뉴스레터를 만들어 웹에 올리고(인사이트 > 뉴스레터) 등록된 이메일로 보낸다.
// AI를 쓰지 않는다. 사이트에 이미 있는 글(출처 링크가 달린 것)만 정해진 규격대로 골라 담는다.
// 이메일은 Resend(resend.com)로 보낸다: RESEND_API_KEY, LETTER_FROM(보내는 주소). 키가 없으면 웹에만 올린다.
const crypto = require('crypto');

// ── 규격 ── 순서와 개수는 항상 같다. 담을 글이 없는 칸은 통째로 뺀다. 모든 항목에 출처 링크가 있어야 한다.
const SPEC = [
  { id: 'head', label: '오늘의 머리기사', max: 1 },   // 가장 새로운 AI·해커톤·제주 창업 기사 1건
  { id: 'hack', label: '해커톤', max: 3 },            // 참가자 많은 열린 해커톤
  { id: 'ai', label: 'AI · 창업 인사이트', max: 3 },  // 클리핑한 기사 (주제가 겹치지 않게)
  { id: 'paper', label: '논문', max: 2 },             // 새로 모은 논문
  { id: 'program', label: '지원사업', max: 2 },       // 창업마당 공고
  { id: 'jeju', label: '오늘의 제주', max: 4 },       // 도로 통제, 새로 올라온 장소
  { id: 'hq', label: '섬업 본부', max: 1 },           // 사이트 점수와 AI 직원이 한 일
];
const SITE = () => (process.env.SITE_URL || 'https://jeju-world.vercel.app').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cut = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3);
const dayKey = (d) => kst(d).toISOString().slice(0, 10);
const isUrl = (u) => /^https?:\/\/[^\s"'<>]+$/.test(u || '');
const secret = () => process.env.LETTER_SECRET || process.env.ADMIN_PASSWORD || 'seomup-letter';
const token = (email) => crypto.createHmac('sha256', secret()).update(String(email).toLowerCase()).digest('hex').slice(0, 24);
const validEmail = (e) => /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i.test(e || '');

// 사이트 자료에서 규격대로 고른다
async function collect(ctx) {
  const today = dayKey(); const site = SITE();
  const ins = ctx.load('insights.json', []).filter((x) => x.hidden !== true);
  const fresh = (x, days) => (Date.now() - new Date(x.updatedAt || x.date || 0).getTime()) < days * 86400e3;
  const link = (x) => `${site}/post.html?kind=insight&id=${encodeURIComponent(x.id)}`;
  const src = (x) => (x.source && isUrl(x.source.url) ? x.source : isUrl(x.url) ? { label: x.org || '원문', url: x.url } : null);
  const clips = ins.filter((x) => ['클리핑', '해커톤 소식'].includes(x.category) && src(x) && fresh(x, 4));
  const item = (x) => ({ title: cut(x.title, 90), text: cut(x.summary, 180), tag: x.tag || x.category, source: src(x), link: link(x) });
  const out = {};
  const headPick = clips.find((x) => ['AI 창업', 'AI 동향', '해커톤', '제주 창업'].includes(x.tag)) || clips[0];
  if (headPick) out.head = [item(headPick)];
  const usedTags = new Set(headPick ? [headPick.tag] : []); const ai = [];
  for (const x of clips) { if (x === headPick || ai.length >= 3) continue; if (usedTags.has(x.tag) && clips.length > 4) continue; usedTags.add(x.tag); ai.push(item(x)); }
  for (const x of clips) { if (ai.length >= 3) break; if (x !== headPick && !ai.some((a) => a.link === link(x))) ai.push(item(x)); }
  if (ai.length) out.ai = ai;
  const papers = ins.filter((x) => x.category === '논문' && src(x) && fresh(x, 7)).slice(0, 2).map((x) => ({ ...item(x), text: cut(x.summary, 160), sub: cut(x.org, 80) }));
  if (papers.length) out.paper = papers;
  const hacks = (ctx.hackathons ? ctx.hackathons() : []).filter((h) => isUrl(h.url) && h.title).sort((a, b) => (b.participants || 0) - (a.participants || 0)).slice(0, 3)
    .map((h) => ({ title: cut(h.title, 80), text: [h.dates, h.prize ? `상금 ${h.prize}` : '', h.location, h.participants ? `참가 ${Number(h.participants).toLocaleString('ko-KR')}명` : ''].filter(Boolean).join(' · '), source: { label: h.source === 'devpost' ? 'Devpost' : '주최 측 안내', url: h.url }, link: `${site}/hackathons.html` }));
  if (hacks.length) out.hack = hacks;
  const progs = ctx.load('programs.json', []).filter((p) => p.hidden !== true && ((p.source && isUrl(p.source.url)) || isUrl(p.url))).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 2)
    .map((p) => ({ title: cut(p.title, 80), text: cut(p.summary, 160), sub: cut(p.org, 60), source: p.source && isUrl(p.source.url) ? p.source : { label: p.org || '공고 원문', url: p.url }, link: `${site}/post.html?kind=program&id=${encodeURIComponent(p.id)}` }));
  if (progs.length) out.program = progs;
  const jeju = [];
  try { const its = ctx.its ? await ctx.its() : null; if (its && its.road !== null && its.road !== undefined) jeju.push({ title: its.road ? `지금 통제 중인 도로 ${its.road}건` : '지금 통제 중인 도로가 없어요', text: '나가기 전에 통제 구간을 확인하세요.', source: { label: '제주특별자치도 교통정보센터', url: 'https://www.jejuits.go.kr/' }, link: `${site}/info.html?kind=road` }); } catch {}
  for (const p of ctx.load('places.json', []).filter((p) => p.auto && p.hidden !== true && p.source && isUrl(p.source.url) && fresh({ updatedAt: p.lastChecked }, 2)).slice(-3))
    jeju.push({ title: `새로 올라온 곳: ${cut(p.name, 40)}`, text: cut(p.address || p.area, 80), image: p.image, source: p.source, link: `${site}/place.html?id=${encodeURIComponent(p.id)}` });
  if (jeju.length) out.jeju = jeju.slice(0, 4);
  const hq = ctx.load('hq.json', {}); const since = Date.now() - 86400e3; const reports = (hq.log || []).filter((m) => m.kind === 'report' && m.from !== 'halla' && new Date(m.at).getTime() > since);
  const nameOf = (id) => ((hq.agents || []).find((a) => a.id === id) || {}).name || id;
  if (hq.score || reports.length) out.hq = [{ title: hq.score ? `사이트 점수 ${hq.score.total}점 (100점 만점)` : 'AI 직원 근무 보고', text: reports.length ? `지난 하루 AI 직원이 한 일 ${reports.length}건: ${cut(reports.slice(0, 3).map((m) => `${nameOf(m.from)} - ${cut(m.text, 46)}`).join(' / '), 200)}` : '지난 하루에는 새로 한 일이 없었어요.', source: { label: '섬업 본부 기록', url: `${site}/post.html?kind=insight&id=report-${today}` }, link: `${site}/post.html?kind=insight&id=report-${today}` }];
  const keywords = [...new Set([...(out.head || []), ...(out.ai || [])].map((x) => x.tag).filter(Boolean))].slice(0, 3);
  if (keywords.length < 3 && out.hack) keywords.push('해커톤'); if (keywords.length < 3 && out.paper) keywords.push('논문');
  return { date: today, keywords: [...new Set(keywords)].slice(0, 3), sections: SPEC.filter((s) => out[s.id]).map((s) => ({ ...s, items: out[s.id].slice(0, s.max) })), reports: reports.map((m) => ({ who: nameOf(m.from), text: m.text, at: m.at })), score: hq.score || null };
}

// 이메일에서도 깨지지 않게 표(table)와 줄 안 스타일만 쓴다
const C = { ink: '#1B1915', sub: '#6B635A', line: '#E9E4DC', bg: '#F4F1EC', accent: '#FF6B1A', deep: '#C2480A' };
function renderHtml(issue, { unsub = '' } = {}) {
  const site = SITE(); const d = new Date(issue.date + 'T00:00:00Z'); const dateText = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
  const itemHtml = (x, big) => `<tr><td style="padding:${big ? '0 0 6px' : '14px 0'};${big ? '' : `border-top:1px solid ${C.line};`}">
    ${x.image && !big ? `<img src="${esc(x.image)}" width="96" height="72" alt="" style="float:right;margin:0 0 6px 14px;border-radius:10px;object-fit:cover;width:96px;height:72px">` : ''}
    ${x.tag && big ? `<div style="font-size:12px;font-weight:700;color:${C.deep};margin-bottom:6px">#${esc(x.tag)}</div>` : ''}
    <a href="${esc(x.link)}" style="font-size:${big ? 24 : 17}px;line-height:1.35;font-weight:800;color:${C.ink};text-decoration:none">${esc(x.title)}</a>
    ${x.sub ? `<div style="font-size:13px;color:${C.sub};margin-top:4px">${esc(x.sub)}</div>` : ''}
    ${x.text ? `<div style="font-size:${big ? 16 : 14.5}px;line-height:1.65;color:#3A352E;margin-top:8px">${esc(x.text)}</div>` : ''}
    <div style="font-size:12.5px;color:${C.sub};margin-top:8px">출처: <a href="${esc(x.source.url)}" style="color:${C.deep}">${esc(x.source.label || '원문')}</a></div></td></tr>`;
  const section = (s) => `<tr><td style="padding:26px 28px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding-bottom:${s.id === 'head' ? 12 : 4}px"><img src="${site}/letter/${['hack', 'ai', 'paper'].includes(s.id) ? 'stone' : 'gyul'}.png" width="22" height="22" alt="" style="vertical-align:-5px;margin-right:6px"><span style="font-size:19px;font-weight:800;color:${C.accent}">${esc(s.label)}</span></td></tr>
    ${s.items.map((x) => itemHtml(x, s.id === 'head')).join('')}</table></td></tr>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>섬업 레터 ${dateText}</title></head>
<body style="margin:0;background:${C.bg};font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
  <tr><td style="padding:16px 28px 0;font-size:13px;color:${C.sub}" align="center">${dateText} &nbsp;|&nbsp; <a href="${site}/api/letter/view?date=${issue.date}" style="color:${C.sub}">웹에서 보기</a></td></tr>
  <tr><td style="padding:12px 0 0"><a href="${site}"><img src="${site}/letter/header.png" width="600" alt="섬업 레터 · 제주에서 보내는 AI·해커톤·창업 소식" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
  ${issue.keywords.length ? `<tr><td align="center" style="padding:20px 28px 4px"><div style="font-size:14px;font-weight:800;color:${C.accent};margin-bottom:6px">오늘의 낱말</div>${issue.keywords.map((k) => `<div style="font-size:15px;line-height:1.7">#${esc(k)}</div>`).join('')}</td></tr>` : ''}
  ${issue.sections.map(section).join('')}
  <tr><td align="center" style="padding:26px 28px 8px"><a href="${site}" style="display:inline-block;background:${C.accent};color:#ffffff;font-weight:800;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:12px">섬업에서 더 보기</a></td></tr>
  <tr><td align="center" style="padding:10px 0 0"><img src="${site}/letter/footer.png" width="600" alt="" style="display:block;width:100%;height:auto"></td></tr>
  <tr><td align="center" style="padding:16px 28px 26px;font-size:12px;line-height:1.7;color:${C.sub}">섬업 레터는 섬업에 올라온 글 가운데 출처가 있는 것만 골라, 정해진 차례대로 매일 아침 한 번 보내요. 사람이 쓰지 않고 자동으로 엮어요.<br>섬업 · 제주(섬)에서 창업을 거래하다${unsub ? `<br><a href="${esc(unsub)}" style="color:${C.sub}">그만 받기</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`;
}
// 운영자에게만 가는 근무 보고
function renderReport(issue) {
  const site = SITE(); const by = {}; for (const r of issue.reports) (by[r.who] = by[r.who] || []).push(r.text);
  const sc = issue.score;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0;background:${C.bg};font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:18px">
<tr><td style="padding:26px 28px 6px"><div style="font-size:13px;color:${C.sub}">${issue.date} · 운영자용</div><div style="font-size:24px;font-weight:800;margin-top:4px">AI 직원 근무 보고</div></td></tr>
<tr><td style="padding:10px 28px"><div style="font-size:15px;line-height:1.7"><b>한눈에</b><br>지난 하루 한 일 ${issue.reports.length}건 · 일한 직원 ${Object.keys(by).length}명${sc ? ` · 사이트 점수 ${sc.total}점` : ''}</div></td></tr>
${sc ? `<tr><td style="padding:6px 28px"><div style="font-size:14px;font-weight:800;color:${C.accent};margin-bottom:6px">사이트 점수</div>${sc.items.map((x) => `<div style="font-size:14px;line-height:1.7;border-top:1px solid ${C.line};padding:6px 0"><b>${esc(x.name)} ${x.score}점</b> <span style="color:${C.sub}">${esc(cut(x.why, 110))}</span></div>`).join('')}</td></tr>` : ''}
<tr><td style="padding:14px 28px 6px"><div style="font-size:14px;font-weight:800;color:${C.accent};margin-bottom:6px">직원별 한 일</div>${Object.keys(by).length ? Object.entries(by).map(([who, list]) => `<div style="border-top:1px solid ${C.line};padding:8px 0"><div style="font-size:15px;font-weight:800">${esc(who)} <span style="font-weight:500;color:${C.sub};font-size:13px">${list.length}건</span></div>${list.slice(0, 8).map((t) => `<div style="font-size:14px;line-height:1.6;color:#3A352E;margin-top:4px">· ${esc(cut(t, 170))}</div>`).join('')}</div>`).join('') : `<div style="font-size:14px;color:${C.sub}">지난 하루에는 보고된 일이 없어요.</div>`}</td></tr>
<tr><td align="center" style="padding:18px 28px 28px"><a href="${site}/hq.html" style="display:inline-block;background:${C.ink};color:#fff;font-weight:800;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:12px">본부에서 자세히 보기</a></td></tr>
</table></td></tr></table></body></html>`;
}
async function sendMail(to, subject, html) {
  const key = process.env.RESEND_API_KEY; if (!key) throw new Error('RESEND_API_KEY가 없어요.');
  const r = await fetch((process.env.RESEND_BASE || 'https://api.resend.com') + '/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.LETTER_FROM || '섬업 레터 <onboarding@resend.dev>', to: [to], subject, html }), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`메일 ${r.status}: ${(await r.text()).slice(0, 140)}`);
}
// 하루 한 번: 엮고, 웹에 올리고, 보낸다. force면 시간과 상관없이 다시 만든다(보내기는 send가 true일 때만)
async function run(ctx, { force = false, send = true } = {}) {
  const st = ctx.load('letter.json', {}); const today = dayKey(); const hour = kst().getUTCHours(); const at = Number.isFinite(Number(st.hour)) ? Number(st.hour) : 6;
  if (!force && (st.enabled === false || st.lastSent === today || hour < at)) return { skipped: true };
  const issue = await collect(ctx); if (!issue.sections.length) return { skipped: true, note: '담을 글이 없어요.' };
  const site = SITE(); const html = renderHtml(issue);
  st.issues = [{ date: today, html }, ...(st.issues || []).filter((x) => x.date !== today)].slice(0, 14);
  // 웹: 인사이트 > 뉴스레터
  const ins = ctx.load('insights.json', []); const id = 'letter-' + today; const head = (issue.sections.find((s) => s.id === 'head') || issue.sections[0]).items[0];
  const post = { id, title: `섬업 레터 · ${today.slice(5).replace('-', '월 ')}일`, category: '뉴스레터', org: '섬업 레터', date: today, summary: cut(`${issue.keywords.map((k) => '#' + k).join(' ')} ${head.title}`, 200), points: issue.sections.map((s) => `${s.label} ${s.items.length}건`).slice(0, 4), url: `${site}/api/letter/view?date=${today}`, source: { label: '섬업 레터 전체 보기', url: `${site}/api/letter/view?date=${today}` },
    body: issue.sections.map((s) => `**${s.label}**\n${s.items.map((x) => `- ${x.title} (출처: ${x.source.label || '원문'})`).join('\n')}`).join('\n\n') + '\n\n섬업 레터는 섬업에 올라온 글 가운데 출처가 있는 것만 골라 자동으로 엮어요.', votes: (ins.find((x) => x.id === id) || {}).votes || 0, updatedAt: today, auto: true, externalId: 'letter:' + today };
  const k = ins.findIndex((x) => x.id === id); if (k >= 0) ins[k] = post; else ins.unshift(post); ctx.save('insights.json', ins);
  let sent = 0, failed = 0, note = '';
  if (send && process.env.RESEND_API_KEY) {
    const list = [...new Set((st.subscribers || []).map((e) => String(e).toLowerCase()).filter(validEmail))].slice(0, 90);
    for (const e of list) { try { await sendMail(e, `[섬업 레터] ${head.title}`, renderHtml(issue, { unsub: `${site}/api/letter/unsub?e=${encodeURIComponent(e)}&t=${token(e)}` })); sent++; } catch (err) { failed++; note = err.message; } }
    if (validEmail(st.operator)) { try { await sendMail(st.operator, `[섬업] AI 직원 근무 보고 ${today}`, renderReport(issue)); sent++; } catch (err) { failed++; note = err.message; } }
  } else if (send) note = '메일 키가 없어 웹에만 올렸어요.';
  if (send) st.lastSent = today; st.lastResult = { at: new Date().toISOString(), sent, failed, note };
  ctx.save('letter.json', st);
  return { date: today, sections: issue.sections.length, sent, failed, note };
}
module.exports = { SPEC, collect, renderHtml, renderReport, run, token, validEmail, dayKey };
