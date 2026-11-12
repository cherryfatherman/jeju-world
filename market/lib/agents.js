// 섬업 본부 엔진: "줄기 하나에 전담 에이전트 하나".
// 구조 원칙 (docs/ops/agent-design.md)
//  - 직무(기획·카피·디자인)로 나누지 않는다. 작업 단위는 '줄기'이고, 줄기마다 전담 에이전트가 처음부터 끝까지 맡는다.
//  - 전담 에이전트는 자기 줄기의 데이터만 읽고, 자기 기억(memory)만 쓴다. 서로 부르지 않는다.
//  - 새 줄기는 생성 틀(TEMPLATE)로 만든다. 기존 에이전트는 건드리지 않는다.
// 토큰 절약 원칙
//  - 숫자 읽기와 제안은 전부 규칙(코드)으로 한다. AI 토큰 0.
//  - AI(Gemini)는 회의록 말투를 입힐 때만 쓰고, 지난 회의와 숫자·제안이 같으면 부르지 않는다.
const crypto = require('crypto');
const { askJSON } = require('./ai');

const DAY = 86400e3;
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null);
const daysLeft = (d) => (d ? Math.ceil((new Date(d + 'T23:59:59').getTime() - Date.now()) / DAY) : null);

function programStatus(p) {
  if (p.status === 'done' || p.status === 'open') return p.status;
  if (p.always) return 'open';
  if (p.end && p.end < today()) return 'done';
  return 'open';
}

// ── 줄기별 전담 에이전트: sense(자기 데이터만 읽기) → propose(할 일 제안) ──
const AGENTS = {
  deal: {
    sense({ load }) {
      const all = load('projects.json', []).filter((p) => p.status === 'live'); const deals = all.filter((p) => (p.type || 'project') === 'project');
      return { open: deals.filter((p) => p.deal !== 'done').length, done: deals.filter((p) => p.deal === 'done').length, real: deals.filter((p) => !p.sample).length, noPhoto: deals.filter((p) => !(p.photos || []).length).length, noArea: all.filter((p) => !p.area && !p.home?.dong).length, inquiries: load('inquiries.json', []).length, goods: all.length - deals.length };
    },
    propose(f, add) {
      if (f.real === 0) add('실제 프로젝트 첫 3건 모으기', '지금 거래 글은 모두 예시예요. 해커톤 참가 팀에게 직접 올려 달라고 부탁해요.');
      if (f.noPhoto > 0) add(`사진 없는 프로젝트 ${f.noPhoto}건 보완`, '사진이 없으면 목록에서 눈에 안 띄어요.');
      if (f.noArea > 0) add(`거래 지역 없는 글 ${f.noArea}건에 동네 넣기`, '동네가 있어야 지도에 보여요.');
      if (f.inquiries > 0) add(`문의 ${f.inquiries}건 답변 확인`, '받은 편지함의 문의에 답이 갔는지 확인해요.');
    },
  },
  program: {
    sense({ load, feedState }) {
      const list = load('programs.json', []).filter((p) => !p.hidden); const open = list.filter((p) => programStatus(p) === 'open');
      return { open: open.length, done: list.length - open.length, closing: open.filter((p) => !p.always && p.end && daysLeft(p.end) <= 14).map((p) => ({ title: p.title, left: daysLeft(p.end) })), auto: list.filter((p) => p.auto).length, feedOk: !!feedState('kstartup').ok };
    },
    propose(f, add) {
      for (const c of f.closing) add(`마감 임박: ${c.title}`, `${c.left <= 0 ? '오늘 마감' : c.left + '일 남았어요'}. 홈 상단에 올리고 스레드에 한 번 알려요.`);
      if (!f.feedOk) add('K-Startup 공고 API 활용신청', '공공데이터포털 15125364를 신청하면 전국 공고가 매일 자동으로 들어와요. AI 토큰은 들지 않아요.');
      if (f.open < 5) add('진행 중 공고 5건 이상 유지', `지금 ${f.open}건이에요.`);
    },
  },
  insight: {
    sense({ load }) { const list = load('insights.json', []).filter((p) => !p.hidden); return { count: list.length, categories: new Set(list.map((i) => i.category)).size, newestDays: daysSince(list.map((i) => i.updatedAt).filter(Boolean).sort().pop()) }; },
    propose(f, add) {
      if (f.newestDays !== null && f.newestDays > 14) add('이번 주 인사이트 1건 추가', `마지막 추가가 ${f.newestDays}일 전이에요.`);
      if (f.count < 20) add('제주 창업 관련 논문 5건 찾기', 'KCI·RISS에서 "제주 창업"으로 찾아 숫자 세 개씩 뽑아요.');
    },
  },
  hackathon: {
    sense({ load }) { const h = load('hackathons.json', { items: [] }); return { open: (h.items || []).length, winners: load('winners.json', []).length, feedDays: daysSince(h.updatedAt) }; },
    propose(f, add) {
      if (f.feedDays !== null && f.feedDays > 2) add('해커톤 일정 수집 점검', `마지막 수집이 ${f.feedDays}일 전이에요.`);
      add('수상작 중 제주에 맞는 아이디어 3개 골라 소개', '수상작 도감이 그냥 목록이면 다시 올 이유가 없어요.');
    },
  },
  community: {
    sense({ load }) { const c = load('comments.json', []); const week = Date.now() - 7 * DAY; return { votes: Object.values(load('votes.json', {})).reduce((a, b) => a + b, 0), comments: c.filter((x) => !x.hidden).length, commentsWeek: c.filter((x) => new Date(x.createdAt).getTime() > week).length, feedback: load('feedback.json', []).length, waitlist: load('waitlist.json', []).length }; },
    propose(f, add) {
      if (f.commentsWeek === 0) add('이번 주 첫 이야기 만들기', '최근 7일 이야기가 0건이에요. 글마다 질문 한 줄을 달아 대화를 열어요.');
      if (f.feedback > 0) add(`정보 제보 ${f.feedback}건 처리`, '제보를 반영하고 고쳤다고 알려요.');
    },
  },
  life: {
    sense({ load, feedState }) { const g = load('guides.json', []).filter((p) => !p.hidden); const pl = load('places.json', []).filter((p) => !p.hidden); return { guides: g.length, places: pl.length, staleGuides: g.filter((x) => (daysSince(x.lastChecked) ?? 0) > 90).length, noCoord: pl.filter((p) => !p.lat).length, tourOk: !!feedState('tour').ok }; },
    propose(f, add) {
      if (f.staleGuides > 0) add(`90일 넘은 생활정보 ${f.staleGuides}건 다시 확인`, '오래된 생활 정보는 신뢰를 깎아요.');
      if (f.noCoord > 0) add(`좌표 없는 장소 ${f.noCoord}곳에 위치 넣기`, '위치가 있어야 지도에 보여요.');
      if (!f.tourOk) add('관광 API 연결', '키를 넣으면 관광지·카페·맛집이 매일 자동으로 채워져요. AI 토큰은 들지 않아요.');
    },
  },
  partner: {
    sense({ load }) { const cfg = load('../config.json', {}); return { support: (cfg.support || []).length, ads: cfg.ads?.enabled !== false ? 2 : 0 }; },
    propose(f, add) {
      if (f.support < 5) add('제주 창업 기관 5곳과 연결', `지금 ${f.support}곳이에요. 제주창조경제혁신센터부터 제안해요.`);
      add('제주도 협업 제안서 1장 쓰기', '창업도시 공모와 결을 맞춘 한 장짜리 제안이 필요해요.');
    },
  },
};
// 생성 틀: 새 줄기를 만들면 붙는 기본 전담 에이전트. 운영자가 넣은 할 일만 센다.
const TEMPLATE = { sense: () => ({}), propose: () => {} };
const agentFor = (pillarId) => AGENTS[pillarId] || TEMPLATE;

function sense(ctx) {
  const hq = ctx.load('hq.json', { pillars: [] }); const out = {};
  for (const p of hq.pillars) { try { out[p.id] = agentFor(p.id).sense(ctx); } catch (e) { out[p.id] = { error: e.message }; } }
  return out;
}
// 한 줄기의 제안. 운영자가 지운 제안(memory.dismissed)과 최근 끝낸 일은 다시 내지 않는다.
function proposeFor(pillar, facts, hq) {
  const mem = hq.memory?.[pillar.id] || {}; const skip = new Set([...(mem.dismissed || []), ...hq.tasks.filter((t) => t.pillar === pillar.id).map((t) => t.title)]);
  const owner = hq.agents.find((a) => a.pillar === pillar.id && a.rank === '부서장')?.id || hq.agents.find((a) => a.pillar === pillar.id)?.id || '';
  const out = []; agentFor(pillar.id).propose(facts || {}, (title, why) => { if (!skip.has(title)) out.push({ pillar: pillar.id, owner, title, why }); });
  return out;
}

function scripted(facts, props, hq) {
  const m = [];
  for (const p of hq.pillars) {
    const a = hq.agents.find((x) => x.pillar === p.id && x.rank === '부서장') || hq.agents.find((x) => x.pillar === p.id); if (!a) continue;
    const mine = props.filter((x) => x.pillar === p.id);
    const nums = Object.entries(facts[p.id] || {}).filter(([, v]) => typeof v === 'number').slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
    m.push({ from: a.id, to: 'halla', text: `${p.name} 줄기예요.${nums ? ` 지금 숫자는 ${nums}.` : ''}${mine[0] ? ` 새로 할 일은 "${mine[0].title}"이에요.` : ' 새로 할 일은 없어요.'}` });
  }
  const top = props.slice(0, 3).map((p, i) => `${i + 1}) ${p.title}`).join('  ');
  const sc = facts.score; if (hq.agents.some((a) => a.id === 'halla')) m.push({ from: 'halla', to: 'all', text: `${sc ? `지금 사이트 점수는 ${sc.total}점이에요. 가장 낮은 건 ${sc.lowest}(${sc.lowestScore}점)이고, ${sc.next}. ` : ''}${top ? `이번에는 이 세 가지만 해요. ${top}` : '새로 할 일은 없어요.'}` });
  return m;
}
async function aiTalk(facts, props, hq) {
  // 프롬프트를 짧게: 줄기 대표만 보내고, 숫자는 필요한 것만
  const reps = hq.pillars.map((p) => hq.agents.find((a) => a.pillar === p.id && a.rank === '부서장') || hq.agents.find((a) => a.pillar === p.id)).filter(Boolean);
  const boss = hq.agents.find((a) => a.id === 'halla'); const people = boss ? [boss, ...reps] : reps;
  const prompt = `제주 창업 플랫폼 "섬업"의 줄기별 전담 에이전트 회의록을 씁니다.
규칙: [숫자]와 [제안]에 있는 사실만. [숫자]의 score는 사이트 점수표예요(100점 만점, 기준별 점수). 각 줄기 대표는 자기 줄기가 점수에서 무엇이 부족한지 한 가지를 말하고, 다른 줄기에게 도움이 될 피드백을 한 가지 주세요. halla는 총점과 가장 낮은 기준, 그 기준을 올릴 방법을 말해요. 새 숫자·사실 금지. 한 사람 1~2문장, 쉬운 존댓말(~해요). 줄기 대표는 halla에게 보고, 마지막은 halla가 to "all"로 우선순위 3가지. 메시지는 ${people.length + 1}개 이하.
[사람] ${people.map((a) => `${a.id}=${a.name}(${a.dept}) ${a.persona}`).join(' / ')}
[숫자] ${JSON.stringify(facts)}
[제안] ${props.map((p) => `${p.owner}: ${p.title}`).join(' / ') || '없음'}
JSON만: {"messages":[{"from":"id","to":"id 또는 all","text":""}]}`;
  const o = await askJSON(prompt); const ids = new Set(hq.agents.map((a) => a.id));
  const msgs = (Array.isArray(o.messages) ? o.messages : []).filter((x) => ids.has(x.from) && (x.to === 'all' || ids.has(x.to)) && typeof x.text === 'string' && x.text.trim()).slice(0, 14).map((x) => ({ from: x.from, to: x.to, text: x.text.trim().slice(0, 300) }));
  if (msgs.length < 3) throw new Error('too few messages');
  return msgs;
}

// ── 사이트 점수표: 여섯 가지 기준을 숫자로 잰다 (AI가 매기지 않고 코드가 센다). 회의 때마다 가장 낮은 기준을 놓고 이야기한다 ──
const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));
function scorecard(ctx, facts) {
  const { load } = ctx; const f = facts || {};
  const projects = load('projects.json', []).filter((p) => p.status === 'live' && (p.type || 'project') === 'project');
  const real = projects.filter((p) => !p.sample).length, withPhoto = projects.filter((p) => (p.photos || []).length).length;
  const comments = load('comments.json', []).filter((c) => !c.hidden && !c.staff); const week = comments.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 7 * DAY).length;
  const posts = [...load('programs.json', []), ...load('insights.json', []), ...load('guides.json', [])].filter((p) => !p.hidden);
  const sourced = posts.filter((p) => p.url || p.source?.url || (p.sources || []).length || p.sourceUrl).length;
  const places = load('places.json', []).filter((p) => !p.hidden); const coord = places.filter((p) => p.lat && p.lng).length;
  const feeds = ctx.feeds ? ctx.feeds() : []; const feedsOk = feeds.filter((x) => x.ready && x.ok).length;
  const items = [
    { id: 'deal', name: '실제 거래', weight: 30, score: clamp(real >= 3 ? 70 + Math.min(30, (f.deal?.inquiries || 0) * 10) : real * 22 + Math.min(20, (f.deal?.inquiries || 0) * 5)), why: `실제 프로젝트 ${real}건, 문의 ${f.deal?.inquiries || 0}건`, next: real < 3 ? '해커톤 참가팀에게 직접 부탁해 실제 프로젝트 3건을 받는다' : '첫 거래 사례를 글로 남긴다' },
    { id: 'talk', name: '소통', weight: 15, score: clamp(week * 12 + Math.min(40, comments.length * 4)), why: `방문자 이야기 ${comments.length}건, 최근 7일 ${week}건`, next: '글마다 답하기 쉬운 질문을 달고, 달린 이야기에는 당일에 답한다' },
    { id: 'fresh', name: '새 소식', weight: 15, score: clamp(100 - Math.max(0, (f.hackathon?.feedDays || 0) - 1) * 20 - Math.max(0, (f.insight?.newestDays || 0) - 14) * 2 - Math.max(0, 5 - (f.program?.open || 0)) * 8), why: `해커톤 수집 ${f.hackathon?.feedDays ?? '?'}일 전, 인사이트 ${f.insight?.newestDays ?? '?'}일 전, 진행 공고 ${f.program?.open ?? 0}건`, next: '이번 주 인사이트 1건, 진행 중 공고 5건 이상 유지' },
    { id: 'trust', name: '믿을 수 있는 정보', weight: 15, score: clamp(posts.length ? (sourced / posts.length) * 100 : 0), why: `출처가 달린 글 ${sourced}/${posts.length}`, next: '출처 없는 글에 원문 링크를 단다' },
    { id: 'auto', name: '스스로 굴러감', weight: 15, score: clamp((feeds.length ? (feedsOk / feeds.length) * 70 : 40) + (ctx.env?.ai ? 15 : 0) + (ctx.env?.durable ? 15 : 0)), why: `자동 갱신 ${feedsOk}/${feeds.length}개 정상${ctx.env?.ai ? '' : ', AI 키 없음'}${ctx.env?.durable ? '' : ', 저장소 없음'}`, next: '키 대기 중인 자동 수집(K-Startup, 관광 API)을 연결한다' },
    { id: 'polish', name: '완성도', weight: 10, score: clamp((projects.length ? (withPhoto / projects.length) * 60 : 30) + (places.length ? (coord / places.length) * 40 : 20)), why: `사진 있는 프로젝트 ${withPhoto}/${projects.length}, 위치 있는 장소 ${coord}/${places.length}`, next: '사진 없는 글과 위치 없는 장소를 채운다' },
  ];
  const total = Math.round(items.reduce((a, x) => a + x.score * x.weight, 0) / items.reduce((a, x) => a + x.weight, 0));
  const lowest = [...items].sort((a, b) => a.score - b.score)[0];
  return { total, items, lowest: lowest.id, at: new Date().toISOString() };
}

// ── 한 번의 회의 ──
async function runCycle(ctx, { force = false } = {}) {
  const { load, save } = ctx;
  const hq = load('hq.json', { pillars: [], agents: [], tasks: [], log: [] });
  hq.tasks = hq.tasks || []; hq.log = hq.log || []; hq.memory = hq.memory || {};
  const facts = sense(ctx);
  const card = scorecard(ctx, facts); const low = card.items.find((x) => x.id === card.lowest); const prev = hq.score?.total;
  hq.score = card; hq.scoreHistory = [...(hq.scoreHistory || []), { at: card.at.slice(0, 10), total: card.total }].filter((x, i, arr) => i === arr.length - 1 || x.at !== arr[i + 1].at).slice(-60);
  facts.score = { total: card.total, lowest: low.name, lowestScore: low.score, why: low.why, next: low.next, items: card.items.map((x) => `${x.name} ${x.score}`).join(', ') };
  const props = hq.pillars.flatMap((p) => proposeFor(p, facts[p.id], hq));
  // 가장 낮은 기준을 올리는 일을 본부장 할 일로 올린다 (같은 제목이 이미 있거나 지운 적이 있으면 건너뜀)
  { const title = `점수 올리기: ${low.name} (${low.score}점)`; const boss = hq.agents.find((a) => a.id === 'halla')?.id || ''; const pid = hq.pillars[0]?.id; const dismissed = hq.memory?.[pid]?.dismissed || [];
    if (pid && !hq.tasks.some((t) => t.title.startsWith(`점수 올리기: ${low.name}`)) && !dismissed.some((d) => d.startsWith(`점수 올리기: ${low.name}`))) props.push({ pillar: pid, owner: boss, title, why: `${low.why}. ${low.next}.` }); }
  const at = new Date().toISOString();
  for (const p of props) hq.tasks.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pillar: p.pillar, owner: p.owner, title: p.title, why: p.why, status: 'proposed', by: 'agent', createdAt: at });
  // 지난 회의와 숫자가 같고 새 제안도 없으면 AI를 부르지 않는다 (토큰 0)
  const hash = crypto.createHash('md5').update(JSON.stringify(facts)).digest('hex');
  const changed = hash !== hq.lastCycle?.hash || props.length > 0;
  let messages = [], ai = false, skipped = false;
  // AI가 25초 안에 답하지 않으면 기다리지 않고 정해진 문장으로 대신한다
  const within = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  if (changed || force) { try { messages = await within(aiTalk(facts, props, hq), 25000); ai = true; } catch { messages = scripted(facts, props, hq); } }
  else skipped = true;
  const round = (hq.log[0]?.round || 0) + (skipped ? 0 : 1);
  if (!skipped) hq.log = [...messages.map((m) => ({ ...m, at, round, ai })).reverse(), ...hq.log].slice(0, 300);
  hq.tasks = hq.tasks.slice(0, 200);
  hq.lastCycle = { at, round, ai, added: props.length, hash, skipped };
  save('hq.json', hq);
  return { round, ai, added: props.length, skipped, messages: messages.length, facts };
}

// 운영자가 지운 '에이전트 제안'을 그 줄기의 기억에 남긴다 → 같은 제안을 다시 하지 않는다
function remember(hq, oldTasks, newTasks) {
  hq.memory = hq.memory || {}; const keep = new Set(newTasks.map((t) => t.id));
  for (const t of oldTasks) if (!keep.has(t.id) && t.by === 'agent' && t.status !== 'done') { const m = (hq.memory[t.pillar] = hq.memory[t.pillar] || {}); m.dismissed = [...new Set([...(m.dismissed || []), t.title])].slice(-50); }
  for (const id of Object.keys(hq.memory)) if (!hq.pillars.some((p) => p.id === id)) delete hq.memory[id];
}

// ── 근무: 줄기마다 전담 직원이 자기 페이지에서 한 가지 일을 하고 보고한다 ──
// 하는 일: ① 방문자가 남긴 이야기에 답글 ② 답글 달 것이 없으면 자기 줄기의 글 하나에 이야기 한 줄.
// 지키는 것: 줄기마다 한 번에 1건, 글 하나에 직원 이야기는 1건까지, AI 호출은 근무 한 번에 1회, 글에 없는 사실·숫자는 쓰지 않는다.
// 직원이 쓴 글에는 staff 표시가 붙어 화면에 'AI 직원'으로 보인다 (방문자인 척하지 않는다).
const SHIFT_KINDS = { deal: ['project'], program: ['program'], insight: ['insight'], hackathon: ['hackathon', 'winner'], life: ['guide', 'place'] };
const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
function planShift(ctx, hq) {
  const comments = ctx.load('comments.json', []).filter((c) => !c.hidden); const jobs = []; const taken = new Set();
  const repliedTo = new Set(comments.filter((c) => c.staff && c.parent).flatMap((c) => [c.replyTo || c.parent]));
  const keyOf = (c) => c.key || (c.projectId ? `project:${c.projectId}` : '');
  const leadOf = (pid) => hq.agents.find((a) => a.pillar === pid && a.rank === '부서장') || hq.agents.find((a) => a.pillar === pid);
  // 운영자가 남긴 이야기에는 반드시 답한다 (맨 위 글이든 답글이든, 한 번 근무에 8건까지). 그 글의 줄기 담당이 답하고, 없으면 소통 담당이 답한다
  const pillarOfKind = (kind) => Object.keys(SHIFT_KINDS).find((pid) => SHIFT_KINDS[pid].includes(kind));
  for (const c of comments.filter((x) => x.owner && !x.staff && !repliedTo.has(x.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 8)) {
    const [kind, ...rest] = keyOf(c).split(':'); const id = rest.join(':'); const item = ctx.find(kind, id); if (!item) continue;
    const agent = leadOf(pillarOfKind(kind)) || leadOf('community') || hq.agents[0]; if (!agent) continue;
    taken.add(c.id); jobs.push({ type: 'reply', owner: true, pillar: agent.pillar || 'community', agent, kind, id, title: ctx.titleOf(item), about: cut(item.tagline || item.summary || item.description || '', 160), parent: c.parent || c.id, replyTo: c.id, to: cut(c.name, 20), said: cut(c.text, 200) });
  }
  const pick = (pillar, kinds) => {
    const agent = leadOf(pillar.id); if (!agent) return;
    // ① 답글: 내 줄기 글에 달린, 아직 답이 없는 방문자 이야기 (가장 최근 것)
    const waiting = comments.filter((c) => !c.staff && !c.parent && !repliedTo.has(c.id) && !taken.has(c.id) && kinds.includes(keyOf(c).split(':')[0])).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (waiting) { const [kind, ...rest] = keyOf(waiting).split(':'); const id = rest.join(':'); const item = ctx.find(kind, id); if (item) { taken.add(waiting.id); jobs.push({ type: 'reply', pillar: pillar.id, agent, kind, id, title: ctx.titleOf(item), about: cut(item.tagline || item.summary || item.description || '', 160), parent: waiting.id, replyTo: waiting.id, to: cut(waiting.name, 20), said: cut(waiting.text, 200) }); return; } }
    // ② 이야기: 직원 이야기가 없는 글부터, 한 글에 2건까지
    const counts = {}; for (const c of comments) if (c.staff) counts[keyOf(c)] = (counts[keyOf(c)] || 0) + 1;
    const pool = kinds.flatMap((kind) => ctx.catalog(kind).slice(0, 30).map((it) => ({ kind, ...it }))).filter((it) => !(counts[`${it.kind}:${it.id}`] > 0)) // 글 하나에 직원 이야기는 1건까지.sort((a, b) => (counts[`${a.kind}:${a.id}`] || 0) - (counts[`${b.kind}:${b.id}`] || 0));
    const it = pool[0]; if (it) jobs.push({ type: 'note', pillar: pillar.id, agent, kind: it.kind, id: it.id, title: it.title, about: cut(it.summary, 200) });
  };
  for (const p of hq.pillars) if (SHIFT_KINDS[p.id]) pick(p, SHIFT_KINDS[p.id]);
  // 소통 줄기: 다른 줄기가 못 챙긴 이야기에 답글
  const comm = hq.pillars.find((p) => p.id === 'community'); if (comm) pick(comm, ['project', 'program', 'insight', 'hackathon', 'winner', 'guide', 'place']);
  return jobs.filter((j) => j.type === 'reply' || j.pillar !== 'community');
}
// 글쓰기 일감: ① 기사 클리핑(근무마다 1건) ② 수상작 소개 글(하루 1건) ③ 아이디어 제안 글(하루 1건, 최대 12건) — 모두 실제 자료(기사·수상작)를 바탕으로 하고 출처 링크를 단다
const dayKey = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
const leadOfPillar = (hq, pid) => hq.agents.find((a) => a.pillar === pid && a.rank === '부서장') || hq.agents.find((a) => a.pillar === pid);
async function planWriting(ctx, hq, jobs) {
  const daily = hq.shiftDaily && hq.shiftDaily.date === dayKey() ? hq.shiftDaily : { date: dayKey() }; hq.shiftDaily = daily;
  const insights = ctx.load('insights.json', []); const have = new Set(insights.map((x) => x.externalId).filter(Boolean)); const urls = new Set(insights.map((x) => x.url).filter(Boolean));
  const winners = ctx.winners ? ctx.winners() : []; const dayN = Math.floor(Date.now() / DAY);
  const insightLead = leadOfPillar(hq, 'insight'), hackLead = leadOfPillar(hq, 'hackathon'), dealLead = leadOfPillar(hq, 'deal');
  // 기사: 주제마다 가장 새 기사 1건씩, 한 번 근무에 4건까지 (해커톤 기사는 해커톤 담당이 맡는다)
  if (ctx.news) { try { const news = (await ctx.news()).filter((n) => n.title && n.link && !have.has('clip:' + n.id) && !urls.has(n.link)); const seenT = new Set(), seenId = new Set(); let n4 = 0; const start = dayN + new Date().getUTCHours();
      const topics = [...new Set(news.map((n) => n.topic))]; for (let k = 0; k < topics.length && n4 < 4; k++) { const t = topics[(k + start) % topics.length]; const n = news.find((x) => x.topic === t && !seenId.has(x.id) && !seenT.has(x.title)); const agent = (t === '해커톤' ? hackLead : null) || insightLead || hackLead; if (!n || !agent) continue;
        seenId.add(n.id); seenT.add(n.title); n4++; jobs.push({ type: 'clip', pillar: agent.pillar, agent, news: n, title: n.title, about: `${n.source || ''} 보도` }); } } catch {} }
  // 논문: 한 번 근무에 2건까지 (제목·학술지·DOI 주소만 싣는다)
  if (insightLead && ctx.papers) { try { const papers = (await ctx.papers()).filter((x) => !have.has('paper:' + x.id) && !urls.has(x.link)); const seenP = new Set(); for (const x of papers) { if (seenP.size >= 2) break; if (seenP.has(x.id)) continue; seenP.add(x.id); jobs.push({ type: 'paper', pillar: 'insight', agent: insightLead, paper: x, title: x.title, about: `${x.journal || '학술지'} ${x.year || ''}` }); } } catch {} }
  if (hackLead && winners.length && !daily.pick) { const w = winners.filter((x) => !have.has('pick:' + x.id))[dayN % Math.max(1, Math.min(60, winners.length))] || winners.find((x) => !have.has('pick:' + x.id)); if (w) jobs.push({ type: 'pick', pillar: 'hackathon', agent: hackLead, winner: w, title: w.name, about: cut(w.tagline, 200) }); }
  if (dealLead && winners.length && !daily.idea) { const ideas = ctx.load('projects.json', []).filter((p) => p.staffIdea && p.status === 'live'); const used = new Set(ideas.map((p) => p.ideaFrom)); const w = winners.slice(0, 80).filter((x) => !used.has(x.id))[(dayN * 7) % 40] || winners.find((x) => !used.has(x.id)); if (w && ideas.length < 12) jobs.push({ type: 'idea', pillar: 'deal', agent: dealLead, winner: w, title: w.name, about: cut(w.tagline, 200) }); }
}
const scriptedLine = (j) => (j.owner ? `운영자님, 남기신 이야기 확인했어요. ${j.agent.dept || '담당'}에서 살펴보고 다음 근무 보고에 적을게요.` : j.type === 'reply' ? `${j.to || '방문자'}님, 이야기 남겨 주셔서 고마워요. ${j.agent.dept || '담당'}에서 확인하고 있어요.` : `이 글에서 궁금한 점이 있으면 여기에 남겨 주세요. ${j.agent.dept || '담당'}에서 보고 답할게요.`);
async function writeShift(jobs) {
  const prompt = `제주 창업 플랫폼 "섬업"의 AI 직원들이 자기 담당 글에 한 줄씩 남깁니다. 각 작업에 맞는 글을 쓰세요.
규칙: 1~2문장, 쉬운 존댓말(~해요). [글]에 적힌 내용만 근거로 하고 새로운 사실·숫자·약속·가격은 절대 쓰지 마세요. 광고처럼 쓰지 마세요.
이미 일어난 일이나 앞으로 일어날 일을 단정하지 마세요(예: "끝났네요", "열려요" 금지). 날짜·기간·금액은 [글]에 있는 표현을 그대로 옮길 때만 쓰세요.
clip은 기사 제목을 쉬운 말 한 문장으로 바꿔 씁니다(제목에 없는 내용 금지). paper는 영어 논문 제목을 쉬운 한국어 한 문장으로 옮깁니다("~을 다룬 논문이에요" 꼴, 제목에 없는 내용·결과·숫자 금지). pick은 해외 해커톤 수상작을 소개하며 "제주에서라면 이렇게 써 볼 수 있겠다"는 직원의 생각을 2문장으로 씁니다(생각이라고 드러나게, 사실처럼 쓰지 않기). idea는 [글]의 수상작이 푸는 문제를 제주(도민·여행자·소상공인·농가 중 하나)에 맞게 바꾼 서비스 아이디어를 제안합니다. 수상작과 같은 종류의 문제를 다뤄야 합니다: name(20자 이내 한국어 이름), tagline(40자 이내), text(2~3문장, 아직 만들어지지 않은 아이디어라는 점이 드러나게, 사용자 수·매출 같은 숫자 금지).
방문자가 '운영자'로 표시된 reply는 운영자의 말에 담당 직원으로서 성실히 답합니다: 질문이면 [글] 안에서 답하고, 지시나 의견이면 "확인했어요"와 함께 무엇을 살펴볼지 한 가지를 말합니다(했다고 거짓으로 말하지 않기). reply는 방문자 말에 공감하고, 답을 모르면 "글 올린 분께 문의하기로 물어보시면 정확해요"처럼 안내합니다. note는 읽는 사람이 답하기 쉬운 질문 하나를 합니다. 이름·직함은 쓰지 마세요(따로 표시됩니다).
[작업]
${jobs.map((j, i) => `${i}. ${j.type}${['reply', 'note'].includes(j.type) ? ` | 직원 성격: ${j.agent.persona || ''}` : ''} | 글: "${j.title}" - ${j.about || '(설명 없음)'}${j.type === 'reply' ? ` | ${j.owner ? '운영자' : '방문자'}(${j.to})의 말: "${j.said}"` : ''}`).join('\n')}
JSON만: {"lines":[{"i":0,"text":"","name":"","tagline":""}]}  (name과 tagline은 idea에만)`;
  const o = await askJSON(prompt); const out = {};
  for (const l of Array.isArray(o.lines) ? o.lines : []) { const t = cut(l.text, 320); if (Number.isInteger(l.i) && jobs[l.i] && t.length >= 8 && !/https?:\/\//.test(t)) { out[l.i] = jobs[l.i].type === 'idea' || jobs[l.i].type === 'pick' ? t : cut(t, 200); out['m' + l.i] = { name: cut(l.name, 20), tagline: cut(l.tagline, 40) }; } }
  return out;
}
async function runShift(ctx) {
  const { load, save } = ctx; const hq = load('hq.json', { pillars: [], agents: [], tasks: [], log: [] }); hq.log = hq.log || [];
  const jobs = planShift(ctx, hq); await planWriting(ctx, hq, jobs); const at = new Date().toISOString(); let ai = false, lines = {};
  if (jobs.length) { try { lines = await Promise.race([writeShift(jobs), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000))]); ai = Object.keys(lines).length > 0; } catch {} }
  const all = load('comments.json', []); const done = [];
  const wrote = []; const today = at.slice(0, 10); const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // 글쓰기 일감 처리
  { const ins = load('insights.json', []); let insChanged = false; const projs = load('projects.json', []); let projChanged = false;
    jobs.forEach((j, i) => {
      if (j.type === 'clip') { const n = j.news; ins.unshift({ id: 'clip-' + n.id, title: cut(n.title, 100), category: n.topic === '해커톤' ? '해커톤 소식' : '클리핑', tag: n.topic || '', org: cut(n.source || '뉴스', 60), date: n.date || today, summary: lines[i] || cut(n.title, 200), points: [], url: n.link, source: { label: cut(n.source || '원문', 60), url: n.link }, body: `${j.agent.dept || '인사이트부'} AI 직원 ${j.agent.name}이(가) 골라 온 기사예요. 내용은 원문에서 확인해 주세요.`, votes: 0, updatedAt: today, auto: true, externalId: 'clip:' + n.id }); insChanged = true; wrote.push({ j, what: `기사 "${cut(n.title, 30)}"를 인사이트에 클리핑했어요`, link: { kind: 'insight', id: 'clip-' + n.id } }); }
      if (j.type === 'paper') { const x = j.paper; ins.unshift({ id: 'paper-' + x.id, title: cut(x.title, 160), category: '논문', org: cut([x.journal, x.authors].filter(Boolean).join(' · ') || '학술 논문', 120), date: x.date || today, summary: lines[i] || cut(`${x.journal || '학술지'}에 실린 논문이에요.`, 200), points: [], url: x.link, source: { label: cut(x.journal || 'DOI 원문', 60), url: x.link }, body: `${j.agent.dept || '인사이트부'} AI 직원 ${j.agent.name}이(가) 찾아온 논문이에요. 제목과 실린 곳만 옮겼어요. 내용은 원문에서 확인해 주세요.`, votes: 0, updatedAt: today, auto: true, externalId: 'paper:' + x.id }); insChanged = true; wrote.push({ j, what: `논문 "${cut(x.title, 30)}"를 인사이트에 모았어요`, link: { kind: 'insight', id: 'paper-' + x.id } }); }
      if (j.type === 'pick') { const w = j.winner; /* AI가 답하지 않으면 원문 소개만 올린다 */ ins.unshift({ id: 'pick-' + w.id, title: cut(`수상작 다시 보기: ${w.name}`, 100), category: '직원 노트', org: `${j.agent.dept || '해커톤부'} AI ${j.agent.name}`, date: today, summary: cut(w.tagline, 200), points: [], url: w.url, source: { label: 'Devpost (원문)', url: w.url }, body: `**어떤 프로젝트인가요**\n${cut(w.tagline, 300)}${lines[i] ? `\n\n**직원의 생각** (사실이 아니라 의견이에요)\n${lines[i]}` : ''}\n\n${j.agent.dept || '해커톤부'} AI 직원 ${j.agent.name}이(가) 수상작 도감에서 골라 소개해요.`, votes: 0, updatedAt: today, auto: true, externalId: 'pick:' + w.id }); insChanged = true; hq.shiftDaily.pick = true; wrote.push({ j, what: `수상작 "${cut(w.name, 24)}" 소개 글을 인사이트에 올렸어요`, link: { kind: 'insight', id: 'pick-' + w.id } }); }
      if (j.type === 'idea' && lines[i] && lines['m' + i]?.name) { const w = j.winner, m = lines['m' + i]; const id = newId(); projs.push({ id, type: 'project', createdAt: at, status: 'live', sample: true, staffIdea: true, ideaFrom: w.id, photos: [], name: m.name, tagline: m.tagline || cut(lines[i], 40), description: `${lines[i]}\n\n이 글은 섬업 ${j.agent.dept || '거래부'} AI 직원 ${j.agent.name}이(가) 올린 아이디어 제안이에요. 아직 만들어진 서비스가 아니에요. 참고한 해커톤 수상작: ${w.name} (Devpost)`, category: '기타', tags: ['아이디어 제안', 'AI 직원'], url: w.url, origin: `AI 직원 제안 · 참고 ${cut(w.name, 30)}`, stage: 'idea', priceMin: 0, priceMax: 0, dealType: 'cofounder', seller: `${j.agent.dept || '거래부'} AI ${j.agent.name}`, contact: '', interest: 0, views: 0, area: '' }); projChanged = true; hq.shiftDaily.idea = true; wrote.push({ j, what: `아이디어 제안 "${m.name}"을 장터에 올렸어요 (함께 만들 사람 찾기)`, link: { kind: 'project', id } }); }
    });
    if (insChanged) save('insights.json', ins); if (projChanged) save('projects.json', projs); }
  jobs.forEach((j, i) => { if (!['reply', 'note'].includes(j.type)) return; if (!lines[i] && j.type !== 'reply') return; // AI가 못 썼으면 정해진 문장은 답글에만 쓴다 (같은 말이 여러 글에 반복되지 않게)
    const text = lines[i] || scriptedLine(j);
    all.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), key: `${j.kind}:${j.id}`, title: j.title, name: j.agent.name, staff: true, agent: j.agent.id, role: `${j.agent.dept || '섬업'} AI`, ...(j.parent ? { parent: j.parent } : {}), ...(j.replyTo ? { replyTo: j.replyTo } : {}), text, createdAt: at });
    done.push({ ...j, text }); });
  if (done.length) save('comments.json', all);
  // 보고: 직원마다 무슨 일을 했는지 본부장에게, 본부장이 한 줄로 정리
  const round = (hq.log[0]?.round || 0) + 1; const msgs = done.map((d) => ({ from: d.agent.id, to: 'halla', text: `${d.type === 'reply' ? `"${cut(d.title, 28)}"에 달린 ${d.owner ? '운영자' : (d.to || '방문자') + '님'} 이야기에 답글을 남겼어요` : `"${cut(d.title, 28)}"에 이야기를 한 줄 남겼어요`}: ${d.text}`, kind: 'report', link: { kind: d.kind, id: d.id } }));
  for (const w of wrote) msgs.push({ from: w.j.agent.id, to: 'halla', text: w.what, kind: 'report', link: w.link });
  // 스스로 고친 것도 보고한다
  let fixed = []; try { fixed = ctx.fixMissingPhotos ? await ctx.fixMissingPhotos() : []; } catch {}
  const dealLead = hq.agents.find((a) => a.pillar === 'deal' && a.rank === '부서장') || hq.agents.find((a) => a.pillar === 'deal');
  if (fixed.length && dealLead) msgs.push({ from: dealLead.id, to: 'halla', text: `사진이 없던 글 ${fixed.length}건에 서비스 페이지의 대표 이미지를 넣었어요: ${fixed.map((t) => cut(t, 16)).join(', ')}`, kind: 'report' });
  // 생활 줄기: 교통정보센터 자료가 바뀌었으면 알린다
  try { const now = ctx.its ? await ctx.its() : null; const lifeLead = hq.agents.find((a) => a.pillar === 'life' && a.rank === '부서장') || hq.agents.find((a) => a.pillar === 'life');
    if (now && lifeLead && (now.road !== null || now.ev !== null || now.tour !== null)) { const before = hq.itsSeen || {}; const parts = [];
      if (now.road !== null && now.road !== before.road) parts.push(`도로 통제 ${now.road}건`); if (now.ev !== null && now.ev !== before.ev) parts.push(`전기차 충전소 ${now.ev}곳`); if (now.tour !== null && now.tour !== before.tour) parts.push(`관광지 ${now.tour}곳`);
      if (parts.length) msgs.push({ from: lifeLead.id, to: 'halla', text: `교통정보센터 자료를 새로 받아 화면에 반영했어요: ${parts.join(', ')}.`, kind: 'report' }); hq.itsSeen = now; } } catch {}
  const replies = done.filter((d) => d.type === 'reply').length, notes = done.length - replies;
  if (hq.agents.some((a) => a.id === 'halla')) msgs.push({ from: 'halla', to: 'all', text: done.length ? `근무 보고를 받았어요. 답글 ${replies}건, 이야기 ${notes}건${wrote.length ? `, 새 글 ${wrote.length}건` : ''}${fixed.length ? `, 스스로 고친 것 ${fixed.length}건` : ''}이에요.` : (wrote.length ? `근무 보고를 받았어요. 새 글 ${wrote.length}건이에요.` : '이번 근무에는 새로 남길 글이 없었어요.'), kind: 'report' });
  hq.log = [...msgs.map((m) => ({ ...m, at, round, ai })).reverse(), ...hq.log].slice(0, 300);
  try { const card = scorecard(ctx, sense(ctx)); hq.score = card; const low = card.items.find((x) => x.id === card.lowest); const ins = load('insights.json', []); const id = 'report-' + dayKey();
    const todays = hq.log.filter((m) => m.kind === 'report' && m.from !== 'halla' && (m.at || '').slice(0, 10) === today).slice(0, 20).reverse(); const nameOf = (aid) => hq.agents.find((a) => a.id === aid)?.name || aid;
    const post = { id, title: `섬업 일일 보고 · ${dayKey().slice(5).replace('-', '월 ')}일`, category: '섬업 리포트', org: '섬업 본부 AI 한라', date: dayKey(), summary: `사이트 점수 ${card.total}점. 가장 낮은 기준은 ${low.name}(${low.score}점)이에요.`, points: card.items.slice(0, 4).map((x) => `${x.name} ${x.score}점`), url: '', source: { label: '', url: '' },
      body: `**사이트 점수 ${card.total}점** (100점 만점, 코드가 잰 값)\n\n${card.items.map((x) => `- ${x.name} ${x.score}점: ${x.why}`).join('\n')}\n\n**가장 먼저 올릴 것**\n${low.name}: ${low.next}.\n\n**오늘 AI 직원이 한 일**\n${todays.length ? todays.map((m) => `- ${nameOf(m.from)}: ${cut(m.text, 120)}`).join('\n') : '- 아직 없어요.'}\n\n이 보고서는 섬업 본부의 AI 직원이 자동으로 쓰고, 근무할 때마다 고쳐 써요.`, votes: (ins.find((x) => x.id === id) || {}).votes || 0, updatedAt: today, auto: true, externalId: 'staff:report:' + dayKey() };
    const k = ins.findIndex((x) => x.id === id); if (k >= 0) ins[k] = post; else ins.unshift(post); save('insights.json', ins); } catch {}
  if (hq.score && hq.log[0] && hq.log[0].from === 'halla' && hq.log[0].at === at) hq.log[0].text += ` 일일 보고서를 고쳐 썼어요(사이트 점수 ${hq.score.total}점).`;
  hq.lastShift = { at, replies, notes, wrote: wrote.length, fixed: fixed.length, ai };
  save('hq.json', hq);
  return { replies, notes, wrote: wrote.length, fixed: fixed.length, ai, at };
}

module.exports = { sense, runCycle, runShift, scorecard, programStatus, remember, AGENTS };
