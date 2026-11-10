// AI 기능 (Google Gemini). 키가 없거나 실패하면 규칙 기반 초안으로 자동 전환한다.
//  - generateListing : 프로젝트(주소) → 소개글
//  - generateHome    : 집(사진 + 서류 사진) → 면적·층·용도 등 추출 + 소개글
//  - generateItem    : 물건(사진) → 제목·설명·가격대
//  - answerWaste     : "이거 어디 버려요?" (제주 배출 규칙 기준)
//  - generateThreadsPosts : 스레드 글 초안
const GEMINI_KEY = () => process.env.GEMINI_API_KEY || '';
// 모델은 순서대로 시도한다. 하나가 404(종료)·503(혼잡)·429(한도)면 다음 모델로 넘어간다.
const MODELS = () => [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'].filter(Boolean);
const CATEGORIES = ['생산성', '마케팅', '교육', '커뮤니티', '데이터·분석', '커머스', '헬스·웰빙', '개발도구', '지역·로컬', '기타'];
const ITEM_CATEGORIES = ['가전·디지털', '가구·인테리어', '생활·주방', '농수산물', '의류·잡화', '취미·도서', '유아·반려', '차량·레저', '기타'];
let lastGood = null; // 마지막으로 성공한 모델을 먼저 쓴다

function imagePart(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null;
}

async function callGemini(parts) {
  if (!GEMINI_KEY()) throw new Error('no key');
  const order = [...new Set([lastGood, ...MODELS()].filter(Boolean))];
  let lastErr = null;
  for (const model of order) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY() },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.5, responseMimeType: 'application/json' } }),
        signal: AbortSignal.timeout(45000),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        lastErr = new Error(`gemini ${model} ${r.status} ${t.slice(0, 160).replace(/\s+/g, ' ')}`);
        console.warn('[ai]', lastErr.message);
        if ([404, 429, 500, 503].includes(r.status)) continue; // 다음 모델
        throw lastErr;
      }
      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
      lastGood = model;
      return JSON.parse(text.replace(/^```json\s*|```$/g, ''));
    } catch (e) {
      lastErr = e; console.warn('[ai]', model, e.message);
      if (e.name === 'TimeoutError' || e.name === 'AbortError') continue;
      if (!/^gemini /.test(e.message)) continue;
    }
  }
  throw lastErr || new Error('gemini unavailable');
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
  const prompt = `당신은 "탐라도감"(AI로 만든 작은 서비스와 해커톤 프로젝트를 다음 주인에게 넘기는 장터)의 등록 도우미입니다.
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
  const prompt = `당신은 제주 지역 생활 장터 "탐라도감"의 집(방·집·상가) 등록 도우미입니다.
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
  const prompt = `당신은 제주 지역 생활 장터 "탐라도감"의 중고·농산물 등록 도우미입니다. 첨부 사진 ${photos.length}장과 메모를 보고 판매 글을 쓰세요.
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
// AI 키가 없어도 자주 묻는 품목은 바로 답한다 (일반 분리배출 기준 + 제주 요일제)
const WASTE_KB = [
  { k: ['아이스팩'], cat: '비닐류/일반', a: '젤 타입(고흡수성 수지)은 내용물째 종량제봉투(일반쓰레기)로 버려요. 물만 든 아이스팩은 물을 버리고 비닐은 비닐류로 분리해요. 동네 주민센터·마트에 아이스팩 수거함이 있으면 거기가 가장 좋아요.' },
  { k: ['깨진 유리', '유리컵', '유리 파편', '거울', '도자기', '그릇'], cat: '불연성', a: '깨진 유리·도자기·거울은 재활용 병류가 아니라 불연성 쓰레기예요. 신문지나 두꺼운 종이로 감싸 "깨진 유리"라고 적어서 불연성 배출 요일에 내놓으세요. 손 다치지 않게 조심!' },
  { k: ['택배 상자', '박스', '종이상자', '골판지'], cat: '종이류', a: '테이프와 송장(운송장)을 떼고 납작하게 접어 종이류로 배출해요. 송장은 개인정보라 찢어서 일반쓰레기로.' },
  { k: ['페트병', '패트병', '생수병', '음료수병'], cat: '플라스틱류', a: '내용물을 비우고 헹군 뒤 라벨을 떼고 찌그러뜨려 뚜껑을 닫아 플라스틱류(투명 페트는 따로 모으는 곳이 있으면 따로)로 배출해요.' },
  { k: ['헌 옷', '옷', '의류', '신발', '가방'], cat: '의류수거함', a: '의류·신발·가방은 의류수거함에 넣어요. 속옷·양말·이불·베개는 수거함에 넣지 말고 종량제봉투로. 입을 만한 옷은 아름다운가게 같은 곳에 기부해도 좋아요.' },
  { k: ['건전지', '배터리', '폐건전지'], cat: '전용 수거함', a: '건전지는 일반쓰레기 금지예요. 주민센터·재활용도움센터의 폐건전지 수거함에 넣어요. 보조배터리·휴대폰 배터리도 같아요.' },
  { k: ['형광등', '전구', 'led'], cat: '전용 수거함', a: '형광등은 깨지지 않게 주민센터·재활용도움센터 전용 수거함에 넣어요. 깨졌으면 신문지에 싸서 불연성으로. LED·백열전구는 불연성 쓰레기예요.' },
  { k: ['스티로폼', '스티로품', '아이스박스'], cat: '스티로폼', a: '테이프·송장·스티커를 떼고 이물질을 닦아 스티로폼 배출 요일에 내놓아요. 색깔 있거나 음식물 묻은 스티로폼은 종량제봉투로.' },
  { k: ['비닐', '봉지', '뽁뽁이', '에어캡', '랩'], cat: '비닐류', a: '깨끗한 비닐·봉지·에어캡은 비닐류로 모아 배출해요. 음식물 묻은 비닐은 종량제봉투로.' },
  { k: ['캔', '참치캔', '맥주캔', '부탄가스', '스프레이'], cat: '캔·고철류', a: '캔은 헹궈서 캔·고철류로. 부탄가스·스프레이는 구멍을 뚫지 말고(화재 위험) 내용물을 다 쓴 뒤 캔류로 배출해요.' },
  { k: ['우유팩', '종이팩', '두유팩', '멸균팩'], cat: '종이팩', a: '우유팩·종이팩은 일반 종이와 섞지 말고 헹궈 말린 뒤 종이팩으로 따로 모아요. 재활용도움센터에 가져가면 종량제봉투나 휴지로 바꿔 주는 곳도 있어요.' },
  { k: ['음식물', '음식', '과일 껍질', '귤껍질', '감귤 껍질'], cat: '음식물', a: '귤껍질·과일 껍질·남은 음식은 음식물 종량제봉투나 RFID 음식물 수거함에. 단, 뼈·조개껍데기·달걀 껍데기·씨앗(복숭아씨 등)·차 찌꺼기는 일반쓰레기예요.' },
  { k: ['가구', '침대', '매트리스', '소파', '책상', '장롱', '대형'], cat: '대형폐기물', a: '가구·매트리스 등 대형폐기물은 읍면동 주민센터 또는 제주도 대형폐기물 신고 앱으로 신고하고 수수료를 낸 뒤 스티커를 붙여 지정 장소에 내놓아요.' },
  { k: ['냉장고', '세탁기', '에어컨', 'tv', '텔레비전', '가전'], cat: '폐가전 무상수거', a: '냉장고·세탁기·에어컨·TV 같은 대형 가전은 "폐가전 무상방문수거(1599-0903)"로 예약하면 무료로 가져가요. 소형 가전은 주민센터 수거함.' },
  { k: ['약', '폐의약품', '알약', '시럽'], cat: '폐의약품', a: '먹다 남은 약은 변기나 쓰레기통에 버리지 말고 약국·보건소·주민센터의 폐의약품 수거함에 넣어요.' },
  { k: ['화장품', '화장품 용기', '로션'], cat: '내용물 비우기', a: '내용물을 다 비운 뒤 재질 표시(플라스틱/유리)대로 배출해요. 내용물이 남아 있으면 종량제봉투로. 펌프 부분은 플라스틱류.' },
  { k: ['컵라면', '라면 용기', '일회용 컵', '종이컵'], cat: '혼합', a: '컵라면 용기는 헹궈서 재질 표시대로(스티로폼/종이). 코팅된 종이컵은 깨끗하면 종이류, 더러우면 일반쓰레기.' },
  { k: ['기름', '식용유', '폐식용유'], cat: '폐식용유', a: '식용유는 하수구에 버리면 안 돼요. 식혀서 페트병에 담아 주민센터·아파트 폐식용유 수거함에 넣거나, 키친타월에 적셔 종량제봉투로.' },
  { k: ['나무', '화분', '흙', '낙엽', '가지'], cat: '혼합', a: '흙·돌·낙엽은 일반 종량제봉투(소량) 또는 불연성. 플라스틱 화분은 흙을 털고 플라스틱류. 나뭇가지는 묶어서 대형폐기물 신고(양이 많을 때).' },
  { k: ['칫솔', '볼펜', '장난감', '플라스틱 잡동사니'], cat: '일반', a: '여러 재질이 섞인 작은 플라스틱(칫솔·볼펜·작은 장난감)은 재활용이 어려워 종량제봉투(일반쓰레기)로 버려요.' },
];
function localWaste(question, rules) {
  const q = question.replace(/\s+/g, '').toLowerCase();
  const hit = WASTE_KB.find((e) => e.k.some((w) => q.includes(w.replace(/\s+/g, '').toLowerCase())));
  if (!hit) return null;
  const day = Object.entries(rules.days || {}).filter(([, v]) => v.includes(hit.cat.split('/')[0].replace('류', ''))).map(([d]) => d);
  const today = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
  return { answer: hit.a + (day.length ? `\n\n📆 ${rules.area || '제주시'} 클린하우스 기준 "${hit.cat}" 배출 요일: ${day.join('·')}요일.` : ''), canToday: day.length ? day.includes(today) : null, nextDay: day.length && !day.includes(today) ? day[0] : null, caution: '일반적인 분리배출 기준이에요. 동네 안내판과 다르면 안내판이 우선이에요.', ai: false, source: 'kb' };
}
async function answerWaste({ question, rules, area }) {
  // 1) 자주 묻는 품목은 검증된 기본 지식으로 바로 답한다 (일관성·신뢰)
  const kb = localWaste(question, { ...rules, area });
  if (kb) return kb;
  // 2) 없으면 AI가 일반 분리배출 상식 + 요일표로 답한다
  const today = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
  const table = Object.entries(rules.days || {}).map(([d, v]) => `${d}요일: ${v}`).join('\n');
  const prompt = `당신은 제주 ${area} 생활 도우미입니다. 한국의 일반적인 분리배출 기준(환경부 '재활용품 분리배출 가이드라인')과 아래 요일표를 함께 써서 답하세요.
- 재질이 무엇인지, 어떻게 비우고 씻고 분리하는지, 어느 분류(플라스틱류·비닐류·종이류·캔·병·스티로폼·불연성·종량제봉투·전용수거함·대형폐기물)인지 구체적으로.
- 그 분류가 요일표에 있으면 오늘 배출 가능 여부와 다음 가능 요일을 말하세요. 표에 없는 분류(예: 종량제봉투, 전용수거함)는 "요일 상관없음"으로.
- 확신이 없는 지역 규칙만 "읍면동 주민센터에 확인"이라고 덧붙이세요. 전부 모른다고 하지 마세요.
오늘은 ${today}요일입니다.
[요일별 배출 규칙 (클린하우스 기준)]
${table}
[공통 안내] ${rules.notes || ''}
[질문] ${question}
JSON으로만: {"answer":"3~5문장, 쉬운 말","canToday":true|false|null,"nextDay":"요일 또는 null","caution":"주의 한 줄 또는 null"}`;
  try { const o = await askJSON(prompt); return { answer: String(o.answer || ''), canToday: o.canToday ?? null, nextDay: o.nextDay || null, caution: o.caution || null, ai: true }; }
  catch {
    const q = question.toLowerCase();
    const hit = Object.entries(rules.days || {}).filter(([, v]) => q.split(/\s+/).some((w) => w.length > 1 && v.includes(w)));
    return { ai: false, canToday: null, nextDay: hit[0]?.[0] || null, caution: null,
      answer: hit.length ? `표 기준으로 "${hit.map(([d]) => d + '요일').join(', ')}"에 배출하는 품목으로 보여요. 정확한 분류는 아래 요일표와 주민센터 안내를 확인해 주세요.` : '지금은 자동 답변이 어려워요. 아래 요일표를 확인하거나 읍면동 주민센터에 문의해 주세요.' };
  }
}

/* ───────── 스레드 글 ───────── */
async function generateThreadsPosts({ projects, hackathons }) {
  const top = projects.slice().sort((a, b) => (b.interest || 0) - (a.interest || 0)).slice(0, 3);
  const soon = hackathons.slice(0, 3);
  const prompt = `당신은 "탐라도감" 운영자입니다. 탐라도감은 사진·서류·주소를 올리면 AI가 30초 만에 글을 써주는 제주 생활 장터(집·물건·프로젝트)입니다.
스레드(Threads)에 올릴 한국어 글 3개. 각 280자 이내, 친근하고 담백하게, 해시태그 2개 이하, 이모지 1~2개.
1번: 이번 주 관심 많은 글 소개  2번: 곧 열리는 해커톤 알림  3번: 오일장신문처럼 글 쓰기 귀찮던 경험 + 탐라도감 소개
[관심 많은 글] ${JSON.stringify(top.map((p) => ({ name: p.name, tagline: p.tagline, interest: p.interest })))}
[곧 열리는 해커톤] ${JSON.stringify(soon.map((h) => ({ title: h.title, dates: h.dates, prize: h.prize })))}
JSON으로만: {"posts":["글1","글2","글3"]}`;
  try { const out = await askJSON(prompt); return { posts: (out.posts || []).map(String).slice(0, 3), ai: true }; }
  catch {
    const p = top[0], h = soon[0];
    return { ai: false, posts: [
      p ? `이번 주 탐라도감에서 가장 관심을 받은 글: ${p.name} — ${p.tagline} 👀 #탐라도감 #제주` : '탐라도감에 첫 글이 올라오길 기다리고 있어요 👀 #탐라도감',
      h ? `곧 열리는 해커톤 🔔 ${h.title} (${h.dates}${h.prize ? `, 상금 ${h.prize}` : ''}). 끝나면 결과물을 탐라도감에 올려 주세요. #해커톤` : '이번 주 해커톤 일정은 탐라도감에서 확인하세요 🔔',
      '방 내놓을 때 글 쓰기 귀찮으셨죠? 탐라도감은 사진이랑 서류만 올리면 AI가 30초 만에 글을 써줘요 🍊 #탐라도감 #제주',
    ] };
  }
}

module.exports = { generateListing, generateHome, generateItem, answerWaste, localWaste, generateThreadsPosts, CATEGORIES, ITEM_CATEGORIES };
