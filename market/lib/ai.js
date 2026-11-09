// AI 기능: 판매 소개글 생성, 스레드 글 초안 생성
// Google Gemini API(무료 구간) 사용. 키가 없거나 실패하면 규칙 기반 예시로 자동 전환한다.
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('no key');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, responseMimeType: 'application/json' } }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const d = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text);
}

// 판매자가 올린 주소의 페이지에서 제목·설명을 읽어온다 (실패해도 진행)
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

const CATEGORIES = ['생산성', '마케팅', '교육', '커뮤니티', '데이터·분석', '커머스', '헬스·웰빙', '개발도구', '지역·로컬', '기타'];

async function generateListing({ url, hint }) {
  const page = await peek(url);
  const prompt = `당신은 "바톤"이라는, AI로 만든 작은 서비스와 해커톤 프로젝트를 사고파는 장터의 등록 도우미입니다.
아래 정보를 바탕으로 판매 등록 글을 한국어로 작성하세요. 과장하지 말고, 모르는 것은 지어내지 마세요.

[서비스 주소] ${url}
[페이지 제목] ${page.title}
[페이지 설명] ${page.desc}
[페이지 본문 일부] ${page.text}
[판매자 메모] ${hint || '(없음)'}

JSON 형식으로만 답하세요:
{
 "name": "서비스 이름 (20자 이내)",
 "tagline": "한 줄 소개 (40자 이내, 무엇을 해결하는지)",
 "description": "소개글 (300~500자. 어떤 문제를 풀고, 누가 쓰고, 지금 어느 단계이며, 다음 주인이 이어가면 어떤 가능성이 있는지. 문단 2~3개)",
 "category": "${CATEGORIES.join(' | ')} 중 하나",
 "tags": ["태그 3~5개"],
 "priceMin": 추정 최소 가격(원, 숫자),
 "priceMax": 추정 최대 가격(원, 숫자),
 "priceReason": "가격대 근거 한 문장 (예: 사용자 없는 데모 단계라 초기 코드 가치 위주)",
 "nextSteps": ["다음 주인이 할 만한 일 3가지"]
}`;
  try {
    const out = await callGemini(prompt);
    return { ...normalize(out), ai: true };
  } catch (e) {
    return { ...fallbackListing(url, page, hint), ai: false, note: '지금은 AI 연결이 어려워 기본 초안을 만들었어요. 내용을 직접 다듬어 주세요.' };
  }
}

function normalize(o) {
  return {
    name: String(o.name || '').slice(0, 40),
    tagline: String(o.tagline || '').slice(0, 80),
    description: String(o.description || '').slice(0, 1500),
    category: CATEGORIES.includes(o.category) ? o.category : '기타',
    tags: (Array.isArray(o.tags) ? o.tags : []).map(String).slice(0, 6),
    priceMin: Number(o.priceMin) || 0,
    priceMax: Number(o.priceMax) || 0,
    priceReason: String(o.priceReason || ''),
    nextSteps: (Array.isArray(o.nextSteps) ? o.nextSteps : []).map(String).slice(0, 3),
  };
}

// 키가 없을 때의 기본 초안: 페이지 정보로 최대한 채운다
function fallbackListing(url, page, hint) {
  const host = url.replace(/^https?:\/\//, '').split('/')[0];
  const name = (page.title || host).split(/[|\-–:]/)[0].trim().slice(0, 40) || host;
  const firstSentence = (s) => (s.match(/^[^.!?。]+[.!?。]?/) || [s])[0].trim();
  return normalize({
    name,
    tagline: page.desc ? page.desc.slice(0, 60) : hint ? firstSentence(hint).slice(0, 60) : `${name} — 다음 주인을 찾습니다`,
    description: [
      page.desc || `${name}은(는) ${host}에서 운영 중인 서비스입니다.`,
      hint ? `판매자 메모: ${hint}` : '',
      '현재 단계와 사용자 수, 기술 구성은 판매자에게 문의해 확인하세요. 다음 주인이 이어가면 기존 결과물을 바탕으로 빠르게 다음 단계로 갈 수 있습니다.',
    ].filter(Boolean).join('\n\n'),
    category: '기타',
    tags: ['AI', '해커톤', '1인개발'],
    priceMin: 300000,
    priceMax: 1500000,
    priceReason: '단계 정보가 없어 데모 단계 기준의 일반적인 범위를 제시했어요.',
    nextSteps: ['실제 사용자 10명 확보', '결제 기능 추가', '소개 페이지 다듬기'],
  });
}

// 스레드(Threads)용 글 초안: 매일 올릴 짧은 글 3개
async function generateThreadsPosts({ projects, hackathons }) {
  const top = projects.slice().sort((a, b) => (b.interest || 0) - (a.interest || 0)).slice(0, 3);
  const soon = hackathons.slice(0, 3);
  const prompt = `당신은 "바톤(Baton)" 운영자입니다. 바톤은 AI로 만든 작은 서비스와 해커톤 프로젝트를 다음 주인에게 넘기는 장터입니다.
스레드(Threads)에 올릴 한국어 글 3개를 써 주세요. 각 글은 280자 이내, 친근하고 담백하게, 해시태그는 2개 이하, 이모지는 1~2개.
1번: 이번 주 관심 많은 프로젝트 소개  2번: 곧 열리는 해커톤 알림  3번: 해커톤 프로젝트가 끝나고 버려지는 문제에 대한 짧은 생각 + 바톤 소개

[관심 많은 프로젝트] ${JSON.stringify(top.map((p) => ({ name: p.name, tagline: p.tagline, interest: p.interest })))}
[곧 열리는 해커톤] ${JSON.stringify(soon.map((h) => ({ title: h.title, dates: h.dates, prize: h.prize })))}

JSON 형식으로만: {"posts": ["글1", "글2", "글3"]}`;
  try {
    const out = await callGemini(prompt);
    return { posts: (out.posts || []).map(String).slice(0, 3), ai: true };
  } catch {
    const p = top[0], h = soon[0];
    return {
      ai: false,
      posts: [
        p ? `이번 주 바톤에서 가장 관심을 받은 프로젝트: ${p.name} — ${p.tagline} 👀 다음 주인을 기다리고 있어요. #바톤 #해커톤` : '바톤에 첫 프로젝트가 올라오길 기다리고 있어요 👀 #바톤',
        h ? `곧 열리는 해커톤 🔔 ${h.title} (${h.dates}${h.prize ? `, 상금 ${h.prize}` : ''}). 결과물은 끝나고 버리지 말고 바톤에 올려 주세요. #해커톤` : '이번 주 해커톤 일정은 바톤에서 확인하세요 🔔 #해커톤',
        '해커톤 프로젝트 대부분은 발표가 끝나면 그대로 멈춥니다. 아깝지 않나요? 바톤은 그 바통을 이어갈 다음 주자를 찾아주는 곳이에요 🏃 #바톤',
      ],
    };
  }
}

module.exports = { generateListing, generateThreadsPosts, CATEGORIES };
