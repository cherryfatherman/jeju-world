// AI 기능 (Google Gemini). 키가 없거나 실패하면 규칙 기반 초안으로 자동 전환한다.
//  - generateListing : 프로젝트(주소) → 소개글
//  - generateHome    : 집(사진 + 서류 사진) → 면적·층·용도 등 추출 + 소개글
//  - generateItem    : 물건(사진) → 제목·설명·가격대
//  - answerWaste     : "이거 어디 버려요?" (제주 배출 규칙 기준)
//  - generateThreadsPosts : 스레드 글 초안
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CATEGORIES = ['생산성', '마케팅', '교육', '커뮤니티', '데이터·분석', '커머스', '헬스·웰빙', '개발도구', '지역·로컬', '기타'];
const ITEM_CATEGORIES = ['가전·디지털', '가구·인테리어', '생활·주방', '농수산물', '의류·잡화', '취미·도서', '유아·반려', '차량·레저', '기타'];

// data:image/...;base64,xxx → Gemini 이미지 파트
function imagePart(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null;
}

async function callGemini(parts) {
  if (!GEMINI_KEY) throw new Error('no key');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.5, responseMimeType: 'application/json' } }),
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const d = await r.json();
  return JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
}
const askJSON = (prompt, images = []) => callGemini([{ text: prompt }, ...images.map(imagePart).filter(Boolean)]);

/* ───────── 프로젝트 ───────── */
async function peek(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'BatonBot/0.1 (+listing preview)' } });
    const html = (await r.text()).slice(0, 200000);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i)?.[1] || '';
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2500);
    return { title, desc, text };
  } catch { return { title: '', desc: '', text: '' }; }
}
async function generateListing({ url, hint }) {
  const page = await peek(url);
  const prompt = `당신은 "바톤"(AI로 만든 작은 서비스와 해커톤 프로젝트를 다음 주인에게 넘기는 장터)의 등록 도우미입니다.
아래 정보로 판매 등록 글을 한국어로 작성하세요. 과장하지 말고, 모르는 것은 지어내지 마세요.
[서비스 주소] ${url}
[페이지 제목] ${page.title}
[페이지 설명] ${page.desc}
[페이지 본문 일부] ${page.text}
[판매자 메모] ${hint || '(없음)'}
JSON으로만 답하세요:
{"name":"이름(20자 이내)","tagline":"한 줄 소개(40자 이내)","description":"소개글 300~500자, 문단 2~3개(문제·사용자·단계·다음 가능성)","category":"${CATEGORIES.join(' | ')} 중 하나","tags":["태그 3~5개"],"priceMin":숫자(원),"priceMax":숫자(원),"priceReason":"가격 근거 한 문장","nextSteps":["다음 주인이 할 일 3가지"]}`;
  try { return { ...normalize(await askJSON(prompt)), ai: true }; }
  catch { return { ...fallbackListing(url, page, hint), ai: false, note: '지금은 AI 연결이 어려워 기본 초안을 만들었어요. 내용을 직접 다듬어 주세요.' }; }
}
function normalize(o) {
  return {
    name: String(o.name || '').slice(0, 40), tagline: String(o.tagline || '').slice(0, 80), description: String(o.description || '').slice(0, 1500),
    category: CATEGORIES.includes(o.category) ? o.category : '기타', tags: (Array.isArray(o.tags) ? o.tags : []).map(String).slice(0, 6),
    priceMin: Number(o.priceMin) || 0, priceMax: Number(o.priceMax) || 0, priceReason: String(o.priceReason || ''),
    nextSteps: (Array.isArray(o.nextSteps) ? o.nextSteps : []).map(String).slice(0, 3),
  };
}
function fallbackListing(url, page, hint) {
  const host = url.replace(/^https?:\/\//, '').split('/')[0];
  const name = (page.title || host).split(/[|\-–:]/)[0].trim().slice(0, 40) || host;
  const first = (s) => (s.match(/^[^.!?。]+[.!?。]?/) || [s])[0].trim();
  return normalize({
    name, tagline: page.desc ? page.desc.slice(0, 60) : hint ? first(hint).slice(0, 60) : `${name} — 다음 주인을 찾습니다`,
    description: [page.desc || `${name}은(는) ${host}에서 운영 중인 서비스입니다.`, hint ? `판매자 메모: ${hint}` : '', '현재 단계와 사용자 수, 기술 구성은 판매자에게 문의해 확인하세요. 다음 주인이 이어가면 기존 결과물을 바탕으로 빠르게 다음 단계로 갈 수 있습니다.'].filter(Boolean).join('\n\n'),
    category: '기타', tags: ['AI', '해커톤', '1인개발'], priceMin: 300000, priceMax: 1500000,
    priceReason: '단계 정보가 없어 데모 단계 기준의 일반적인 범위를 제시했어요.', nextSteps: ['실제 사용자 10명 확보', '결제 기능 추가', '소개 페이지 다듬기'],
  });
}

/* ───────── 집 (사진 + 서류) ───────── */
async function generateHome({ photos = [], docs = [], hint }) {
  const prompt = `당신은 제주 지역 생활 장터 "바톤"의 집(방·집·상가) 등록 도우미입니다.
첨부 이미지 중 앞 ${docs.length}장은 서류(건축물대장, 등기부등본 등)이고, 나머지 ${photos.length}장은 집 사진입니다.
서류에서 읽을 수 있는 사실만 추출하세요. 읽을 수 없으면 null로 두세요. 절대 추측해서 채우지 마세요.
개인정보(소유자 이름, 주민등록번호, 상세 번지)는 추출하지 마세요. 사진으로는 상태·분위기·옵션만 설명하세요.
[등록자 메모] ${hint || '(없음)'}
JSON으로만 답하세요:
{"name":"제목(예: 아라동 투룸, 채광 좋은 2층) 30자 이내","tagline":"한 줄 소개 40자 이내","description":"소개글 200~400자. 사실(서류)과 인상(사진)을 구분해서 서술","dong":"읍면동 단위 위치(서류에 있을 때만, 예: 제주시 아라일동) 또는 null","areaM2":전용 또는 연면적 숫자(㎡) 또는 null,"floor":"층(예: 2/4층) 또는 null","use":"건축물 용도(예: 다가구주택) 또는 null","builtYear":준공연도 숫자 또는 null,"rooms":"방/욕실 수(예: 2룸 1욕실) 또는 null","options":["사진에서 보이는 옵션(에어컨, 붙박이장 등)"],"condition":"상태 한 줄","dealType":"매매 | 전세 | 월세 | 단기(한달살기) 중 추정 또는 '미정'","extractedFrom":"어떤 서류에서 읽었는지(예: 건축물대장) 또는 null","confidence":"high | medium | low"}`;
  try { return { ...normalizeHome(await askJSON(prompt, [...docs, ...photos])), ai: true }; }
  catch {
    const first = (s) => (s.match(/^[^.!?。\n]+/) || [''])[0].trim();
    return { ...normalizeHome({ name: hint ? first(hint).slice(0, 30) : '새로 올리는 집', tagline: hint ? hint.slice(0, 60) : '위치·조건을 적어 주세요', description: hint || '집 소개를 적어 주세요.', condition: '' }), ai: false, note: 'AI 연결이 어려워 자동 추출을 못 했어요. 제목·면적·층·용도를 직접 입력해 주세요.' };
  }
}
function normalizeHome(o) {
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v) || null);
  return {
    name: String(o.name || '').slice(0, 40), tagline: String(o.tagline || '').slice(0, 80), description: String(o.description || '').slice(0, 1500),
    dong: o.dong ? String(o.dong).slice(0, 40) : '', areaM2: num(o.areaM2), floor: o.floor ? String(o.floor).slice(0, 20) : '', use: o.use ? String(o.use).slice(0, 30) : '',
    builtYear: num(o.builtYear), rooms: o.rooms ? String(o.rooms).slice(0, 20) : '', options: (Array.isArray(o.options) ? o.options : []).map(String).slice(0, 8),
    condition: String(o.condition || '').slice(0, 120), dealType: ['매매', '전세', '월세', '단기'].includes(o.dealType) ? o.dealType : '미정',
    extractedFrom: o.extractedFrom ? String(o.extractedFrom).slice(0, 40) : '', confidence: ['high', 'medium', 'low'].includes(o.confidence) ? o.confidence : 'low',
  };
}

/* ───────── 물건 (사진) ───────── */
async function generateItem({ photos = [], hint }) {
  const prompt = `당신은 제주 지역 생활 장터 "바톤"의 중고·농산물 등록 도우미입니다. 첨부 사진 ${photos.length}장과 메모를 보고 판매 글을 쓰세요.
보이는 것만 설명하고 브랜드·모델은 확실할 때만 쓰세요. 가격은 한국 중고 시세 기준의 대략 범위입니다.
[판매자 메모] ${hint || '(없음)'}
JSON으로만: {"name":"제목 30자 이내","tagline":"한 줄 소개 40자 이내","description":"설명 150~300자(상태, 구성품, 사용감, 거래 방법 제안)","category":"${ITEM_CATEGORIES.join(' | ')} 중 하나","condition":"새상품 | 거의 새것 | 사용감 있음 | 고장·부품용 중 하나","priceMin":숫자(원),"priceMax":숫자(원),"priceReason":"가격 근거 한 문장","tags":["태그 3~5개"]}`;
  try { return { ...normalizeItem(await askJSON(prompt, photos)), ai: true }; }
  catch {
    const first = (s) => (s.match(/^[^.!?。\n]+/) || [''])[0].trim();
    return { ...normalizeItem({ name: hint ? first(hint).slice(0, 30) : '새로 올리는 물건', tagline: hint ? hint.slice(0, 40) : '상태·거래 방법을 적어 주세요', description: hint || '물건 설명을 적어 주세요.', category: '기타', condition: '사용감 있음' }), ai: false, note: 'AI 연결이 어려워 기본 틀만 만들었어요. 내용을 채워 주세요.' };
  }
}
function normalizeItem(o) {
  return {
    name: String(o.name || '').slice(0, 40), tagline: String(o.tagline || '').slice(0, 80), description: String(o.description || '').slice(0, 1500),
    category: ITEM_CATEGORIES.includes(o.category) ? o.category : '기타', condition: String(o.condition || '').slice(0, 20),
    priceMin: Number(o.priceMin) || 0, priceMax: Number(o.priceMax) || 0, priceReason: String(o.priceReason || ''), tags: (Array.isArray(o.tags) ? o.tags : []).map(String).slice(0, 6),
  };
}

/* ───────── 제주 생활: 분리배출 ───────── */
async function answerWaste({ question, rules, area }) {
  const today = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
  const table = Object.entries(rules.days || {}).map(([d, v]) => `${d}요일: ${v}`).join('\n');
  const prompt = `당신은 제주 ${area} 생활 도우미입니다. 아래 배출 규칙 표만 근거로 답하세요. 표에 없는 내용은 "읍면동 주민센터나 제주시 환경과에 확인하세요"라고 하세요.
오늘은 ${today}요일입니다.
[요일별 배출 규칙 (클린하우스 기준)]
${table}
[공통 안내] ${rules.notes || ''}
[질문] ${question}
JSON으로만: {"answer":"3~5문장, 쉬운 말. 분리 방법 + 오늘 버릴 수 있는지 + 다음 가능 요일","canToday":true|false|null,"nextDay":"요일 또는 null","caution":"주의 한 줄 또는 null"}`;
  try { const o = await askJSON(prompt); return { answer: String(o.answer || ''), canToday: o.canToday ?? null, nextDay: o.nextDay || null, caution: o.caution || null, ai: true }; }
  catch {
    const q = question.toLowerCase();
    const hit = Object.entries(rules.days || {}).filter(([, v]) => q.split(/\s+/).some((w) => w.length > 1 && v.includes(w)));
    return { ai: false, canToday: null, nextDay: hit[0]?.[0] || null, caution: null,
      answer: hit.length ? `표 기준으로 "${hit.map(([d]) => d + '요일').join(', ')}"에 배출하는 품목으로 보여요. 정확한 분류는 아래 요일표와 주민센터 안내를 확인해 주세요.` : 'AI 연결이 어려워 자동 답변을 못 했어요. 아래 요일표를 확인하거나 읍면동 주민센터에 문의해 주세요.' };
  }
}

/* ───────── 스레드 글 ───────── */
async function generateThreadsPosts({ projects, hackathons }) {
  const top = projects.slice().sort((a, b) => (b.interest || 0) - (a.interest || 0)).slice(0, 3);
  const soon = hackathons.slice(0, 3);
  const prompt = `당신은 "바톤(Baton)" 운영자입니다. 바톤은 사진·서류·주소를 올리면 AI가 30초 만에 글을 써주는 제주 생활 장터(집·물건·프로젝트)입니다.
스레드(Threads)에 올릴 한국어 글 3개. 각 280자 이내, 친근하고 담백하게, 해시태그 2개 이하, 이모지 1~2개.
1번: 이번 주 관심 많은 글 소개  2번: 곧 열리는 해커톤 알림  3번: 오일장신문처럼 글 쓰기 귀찮던 경험 + 바톤 소개
[관심 많은 글] ${JSON.stringify(top.map((p) => ({ name: p.name, tagline: p.tagline, interest: p.interest })))}
[곧 열리는 해커톤] ${JSON.stringify(soon.map((h) => ({ title: h.title, dates: h.dates, prize: h.prize })))}
JSON으로만: {"posts":["글1","글2","글3"]}`;
  try { const out = await askJSON(prompt); return { posts: (out.posts || []).map(String).slice(0, 3), ai: true }; }
  catch {
    const p = top[0], h = soon[0];
    return { ai: false, posts: [
      p ? `이번 주 바톤에서 가장 관심을 받은 글: ${p.name} — ${p.tagline} 👀 #바톤 #제주` : '바톤에 첫 글이 올라오길 기다리고 있어요 👀 #바톤',
      h ? `곧 열리는 해커톤 🔔 ${h.title} (${h.dates}${h.prize ? `, 상금 ${h.prize}` : ''}). 끝나면 결과물을 바톤에 올려 주세요. #해커톤` : '이번 주 해커톤 일정은 바톤에서 확인하세요 🔔',
      '방 내놓을 때 글 쓰기 귀찮으셨죠? 바톤은 사진이랑 서류만 올리면 AI가 30초 만에 글을 써줘요 🍊 #바톤 #제주',
    ] };
  }
}

module.exports = { generateListing, generateHome, generateItem, answerWaste, generateThreadsPosts, CATEGORIES, ITEM_CATEGORIES };
