// 섬업 본부: 부서별 AI 직원이 사이트 상태를 살피고(센서), 할 일을 제안하고, 회의록을 남긴다.
// 원칙
//  - 숫자는 실제 데이터 파일에서만 읽는다. 지어내지 않는다.
//  - 글을 고치거나 지우는 일은 하지 않는다. '제안'만 만들고 운영자가 승인한다.
//  - Gemini 키가 있으면 회의 말투를 AI가 쓰고, 없거나 실패하면 정해진 문장으로 대신한다.
const { askJSON } = require('./ai');

const DAY = 86400e3;
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null);
const daysLeft = (d) => (d ? Math.ceil((new Date(d + 'T23:59:59').getTime() - Date.now()) / DAY) : null);

// 프로그램 진행/완료 판정 (server.js와 같은 규칙)
function programStatus(p) {
  if (p.status === 'done' || p.status === 'open') return p.status;
  if (p.always) return 'open';
  if (p.end && p.end < today()) return 'done';
  return 'open';
}

// ── 센서: 기둥(부서)별 현재 숫자 ──
function sense({ load, feedState }) {
  const projects = load('projects.json', []).filter((p) => p.status === 'live');
  const deals = projects.filter((p) => (p.type || 'project') === 'project');
  const programs = load('programs.json', []).filter((p) => !p.hidden);
  const insights = load('insights.json', []).filter((p) => !p.hidden);
  const guides = load('guides.json', []).filter((p) => !p.hidden);
  const places = load('places.json', []).filter((p) => !p.hidden);
  const comments = load('comments.json', []);
  const votes = load('votes.json', {});
  const hack = load('hackathons.json', { items: [] });
  const cfg = load('../config.json', {});
  const open = programs.filter((p) => programStatus(p) === 'open');
  const closing = open.filter((p) => !p.always && p.end && daysLeft(p.end) <= 14).map((p) => ({ title: p.title, left: daysLeft(p.end) }));
  const newestInsight = insights.map((i) => i.updatedAt).filter(Boolean).sort().pop();
  const week = Date.now() - 7 * DAY;
  return {
    deal: {
      open: deals.filter((p) => p.deal !== 'done').length, done: deals.filter((p) => p.deal === 'done').length,
      real: deals.filter((p) => !p.sample).length, noPhoto: deals.filter((p) => !(p.photos || []).length).length,
      inquiries: load('inquiries.json', []).length, goods: projects.length - deals.length,
    },
    program: { open: open.length, done: programs.length - open.length, closing, auto: programs.filter((p) => p.auto).length, kstartup: feedState('kstartup') },
    insight: { count: insights.length, newestDays: daysSince(newestInsight), categories: [...new Set(insights.map((i) => i.category))].length },
    hackathon: { open: (hack.items || []).length, winners: load('winners.json', []).length, feedDays: daysSince(hack.updatedAt) },
    community: {
      votes: Object.values(votes).reduce((a, b) => a + b, 0), comments: comments.filter((c) => !c.hidden).length,
      commentsWeek: comments.filter((c) => new Date(c.createdAt).getTime() > week).length, feedback: load('feedback.json', []).length, waitlist: load('waitlist.json', []).length,
    },
    life: { guides: guides.length, places: places.length, staleGuides: guides.filter((g) => (daysSince(g.lastChecked) ?? 0) > 90).length, tourFeed: feedState('tour') },
    partner: { support: (cfg.support || []).length, ads: cfg.ads?.enabled !== false ? 2 : 0 },
  };
}

// ── 규칙: 숫자를 보고 부서별 할 일 제안 ──
function propose(f) {
  const out = [];
  const add = (pillar, owner, title, why) => out.push({ pillar, owner, title, why });
  if (f.deal.real === 0) add('deal', 'oreum', '실제 프로젝트 첫 3건 모으기', '지금 거래 글은 모두 예시예요. 해커톤 참가 팀에게 직접 올려 달라고 부탁해요.');
  if (f.deal.noPhoto > 0) add('deal', 'maru', `사진 없는 프로젝트 ${f.deal.noPhoto}건 보완`, '사진이 없으면 목록에서 눈에 안 띄어요.');
  if (f.deal.inquiries > 0) add('deal', 'sorang', `문의 ${f.deal.inquiries}건 답변 확인`, '받은 편지함의 문의에 답이 갔는지 확인해요.');
  for (const c of f.program.closing) add('program', 'daon', `마감 임박: ${c.title} (${c.left <= 0 ? '오늘' : c.left + '일 남음'})`, '홈 상단에 올리고 스레드에 한 번 알려요.');
  if (!f.program.kstartup?.ok) add('program', 'ieum', 'K-Startup 공고 API 활용신청', '공공데이터포털 15125364를 신청하면 전국 공고가 매일 자동으로 들어와요.');
  if (f.program.open < 5) add('program', 'boreum', '진행 중 공고 5건 이상 유지', `지금 ${f.program.open}건이에요.`);
  if (f.insight.newestDays !== null && f.insight.newestDays > 14) add('insight', 'seulgi', '이번 주 인사이트 1건 추가', `마지막 추가가 ${f.insight.newestDays}일 전이에요.`);
  if (f.insight.count < 20) add('insight', 'garam', '제주 창업 관련 논문 5건 찾기', 'KCI·RISS에서 "제주 창업"으로 찾아 숫자 세 개씩 뽑아요.');
  if (f.hackathon.feedDays !== null && f.hackathon.feedDays > 2) add('hackathon', 'narae', '해커톤 일정 수집 점검', `마지막 수집이 ${f.hackathon.feedDays}일 전이에요.`);
  add('hackathon', 'saebyeol', '수상작 중 제주에 맞는 아이디어 3개 골라 소개', '수상작 도감이 그냥 목록이면 다시 올 이유가 없어요.');
  if (f.community.commentsWeek === 0) add('community', 'dasom', '이번 주 첫 댓글 만들기', '최근 7일 댓글이 0건이에요. 글마다 질문 한 줄을 달아 대화를 열어요.');
  if (f.community.feedback > 0) add('community', 'yeoul', `정보 제보 ${f.community.feedback}건 처리`, '제보를 반영하고 고쳤다고 알려요.');
  if (f.life.staleGuides > 0) add('life', 'badang', `90일 넘은 가이드 ${f.life.staleGuides}건 다시 확인`, '오래된 생활 정보는 신뢰를 깎아요.');
  if (!f.life.tourFeed?.ok) add('life', 'olle', '관광 API 연결', '키를 넣으면 관광지·카페·맛집이 매일 자동으로 채워져요.');
  if (f.partner.support < 5) add('partner', 'nuri', '제주 창업 기관 5곳과 연결', `지금 ${f.partner.support}곳이에요. 제주창조경제혁신센터부터 제안해요.`);
  add('partner', 'hanul', '제주도 협업 제안서 1장 쓰기', '창업도시 공모와 결을 맞춘 한 장짜리 제안이 필요해요.');
  return out;
}

// ── 회의록: 정해진 문장 (AI 없이도 돌아가게) ──
function scripted(f, props, agents) {
  const head = (pillar) => agents.find((a) => a.pillar === pillar && a.rank === '부서장');
  const m = []; const say = (from, to, text) => from && m.push({ from: from.id, to, text });
  say(head('deal'), 'halla', `거래 중 프로젝트 ${f.deal.open}건, 완료 ${f.deal.done}건이에요. 실제 글은 ${f.deal.real}건, 문의는 ${f.deal.inquiries}건 쌓였어요.`);
  say(head('program'), 'halla', `진행 중 공고 ${f.program.open}건, 완료 ${f.program.done}건이에요.${f.program.closing.length ? ` 2주 안에 마감되는 게 ${f.program.closing.length}건 있어요.` : ''}`);
  say(head('insight'), 'halla', `인사이트 ${f.insight.count}건이에요.${f.insight.newestDays !== null ? ` 마지막 추가는 ${f.insight.newestDays}일 전.` : ''}`);
  say(head('hackathon'), 'halla', `열린 해커톤 ${f.hackathon.open}건, 수상작 ${f.hackathon.winners}건을 모아 뒀어요.`);
  say(head('community'), 'halla', `누적 추천 ${f.community.votes}번, 댓글 ${f.community.comments}건이에요. 이번 주 댓글은 ${f.community.commentsWeek}건.`);
  say(head('life'), 'halla', `생활 가이드 ${f.life.guides}건, 여행 장소 ${f.life.places}곳이에요.`);
  say(head('partner'), 'halla', `연결된 기관 링크는 ${f.partner.support}곳이에요.`);
  for (const p of props.slice(0, 6)) { const a = agents.find((x) => x.id === p.owner); const boss = head(p.pillar); if (a && boss && a.id !== boss.id) say(a, boss.id, `${p.title}. ${p.why}`); }
  const top = props.slice(0, 3).map((p, i) => `${i + 1}) ${p.title}`).join('  ');
  m.push({ from: 'halla', to: 'all', text: top ? `이번 주는 이 세 가지만 해요. ${top}` : '이번 주는 지금 상태를 유지해요.' });
  return m;
}

// ── 회의록: Gemini가 같은 숫자로 사람 말투를 입힌다 ──
async function aiTalk(f, props, agents) {
  const roster = agents.map((a) => `${a.id}: ${a.name} (${a.dept} ${a.rank}) - ${a.persona}`).join('\n');
  const prompt = `당신은 제주 창업 플랫폼 "섬업" 본부의 회의록 작성자입니다. 아래 직원들이 주간 회의에서 나눈 대화를 씁니다.
규칙
- 아래 [숫자]와 [제안]에 있는 사실만 씁니다. 새 숫자·새 사실을 만들지 않습니다.
- 한 사람당 1~2문장, 쉬운 한국어 존댓말(~해요). 각자 성격이 드러나게.
- 부서장은 본부장(halla)에게 보고하고, 팀장·팀원은 자기 부서장에게 제안합니다. 서로 한두 번 맞장구나 반대도 합니다.
- 마지막은 halla가 to "all"로 이번 주 우선순위 3가지를 정합니다.
- 메시지 10~14개.
[직원]
${roster}
[숫자]
${JSON.stringify(f)}
[제안]
${props.map((p) => `${p.owner} / ${p.title} / ${p.why}`).join('\n')}
JSON으로만: {"messages":[{"from":"직원id","to":"직원id 또는 all","text":"..."}]}`;
  const o = await askJSON(prompt);
  const ids = new Set(agents.map((a) => a.id));
  const msgs = (Array.isArray(o.messages) ? o.messages : []).filter((x) => ids.has(x.from) && (x.to === 'all' || ids.has(x.to)) && typeof x.text === 'string' && x.text.trim()).slice(0, 16).map((x) => ({ from: x.from, to: x.to, text: x.text.trim().slice(0, 300) }));
  if (msgs.length < 5) throw new Error('too few messages');
  return msgs;
}

// ── 한 번의 회의(사이클) ──
async function runCycle(ctx) {
  const { load, save } = ctx;
  const hq = load('hq.json', { pillars: [], agents: [], tasks: [], log: [] });
  hq.tasks = hq.tasks || []; hq.log = hq.log || [];
  const facts = sense(ctx);
  const props = propose(facts).filter((p) => hq.pillars.some((x) => x.id === p.pillar));
  // 같은 제목의 끝나지 않은 일이 있으면 다시 만들지 않는다
  const openTitles = new Set(hq.tasks.filter((t) => t.status !== 'done').map((t) => t.title));
  const at = new Date().toISOString(); let added = 0;
  for (const p of props) {
    if (openTitles.has(p.title)) continue;
    hq.tasks.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pillar: p.pillar, owner: p.owner, title: p.title, why: p.why, status: 'proposed', by: 'agent', createdAt: at });
    added++;
  }
  let messages, ai = false;
  try { messages = await aiTalk(facts, props, hq.agents); ai = true; } catch { messages = scripted(facts, props, hq.agents); }
  const round = (hq.log[0]?.round || 0) + 1;
  hq.log = [...messages.map((m) => ({ ...m, at, round, ai })).reverse(), ...hq.log].slice(0, 300);
  hq.tasks = hq.tasks.slice(0, 200);
  hq.lastCycle = { at, round, ai, added };
  save('hq.json', hq);
  return { round, ai, added, messages: messages.length, facts };
}

module.exports = { sense, propose, runCycle, programStatus };
