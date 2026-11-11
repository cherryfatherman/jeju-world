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
  if (hq.agents.some((a) => a.id === 'halla')) m.push({ from: 'halla', to: 'all', text: top ? `이번에는 이 세 가지만 해요. ${top}` : '새로 할 일은 없어요. 지금 상태를 유지해요.' });
  return m;
}
async function aiTalk(facts, props, hq) {
  // 프롬프트를 짧게: 줄기 대표만 보내고, 숫자는 필요한 것만
  const reps = hq.pillars.map((p) => hq.agents.find((a) => a.pillar === p.id && a.rank === '부서장') || hq.agents.find((a) => a.pillar === p.id)).filter(Boolean);
  const boss = hq.agents.find((a) => a.id === 'halla'); const people = boss ? [boss, ...reps] : reps;
  const prompt = `제주 창업 플랫폼 "섬업"의 줄기별 전담 에이전트 회의록을 씁니다.
규칙: [숫자]와 [제안]에 있는 사실만. 새 숫자·사실 금지. 한 사람 1~2문장, 쉬운 존댓말(~해요). 줄기 대표는 halla에게 보고, 마지막은 halla가 to "all"로 우선순위 3가지. 메시지는 ${people.length + 1}개 이하.
[사람] ${people.map((a) => `${a.id}=${a.name}(${a.dept}) ${a.persona}`).join(' / ')}
[숫자] ${JSON.stringify(facts)}
[제안] ${props.map((p) => `${p.owner}: ${p.title}`).join(' / ') || '없음'}
JSON만: {"messages":[{"from":"id","to":"id 또는 all","text":""}]}`;
  const o = await askJSON(prompt); const ids = new Set(hq.agents.map((a) => a.id));
  const msgs = (Array.isArray(o.messages) ? o.messages : []).filter((x) => ids.has(x.from) && (x.to === 'all' || ids.has(x.to)) && typeof x.text === 'string' && x.text.trim()).slice(0, 14).map((x) => ({ from: x.from, to: x.to, text: x.text.trim().slice(0, 300) }));
  if (msgs.length < 3) throw new Error('too few messages');
  return msgs;
}

// ── 한 번의 회의 ──
async function runCycle(ctx, { force = false } = {}) {
  const { load, save } = ctx;
  const hq = load('hq.json', { pillars: [], agents: [], tasks: [], log: [] });
  hq.tasks = hq.tasks || []; hq.log = hq.log || []; hq.memory = hq.memory || {};
  const facts = sense(ctx);
  const props = hq.pillars.flatMap((p) => proposeFor(p, facts[p.id], hq));
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

module.exports = { sense, runCycle, programStatus, remember, AGENTS };
