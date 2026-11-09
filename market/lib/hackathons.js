// 해커톤 일정 자동 수집 (Devpost 공개 API). 국내 대회는 data/hackathons.local.json에 손으로 추가.
const fs = require('fs');
const path = require('path');

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();

async function fetchDevpost(pages = 3) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const r = await fetch(`https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&order_by=prize-amount&page=${page}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) break;
    const d = await r.json();
    for (const h of d.hackathons || []) {
      out.push({
        source: 'devpost',
        title: h.title,
        url: h.url,
        prize: strip(h.prize_amount),
        dates: h.submission_period_dates,
        location: h.displayed_location?.location || '온라인',
        participants: h.registrations_count || 0,
        themes: (h.themes || []).map((t) => t.name).slice(0, 3),
        status: h.open_state, // upcoming | open
      });
    }
  }
  return out;
}

function loadLocal() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'hackathons.local.json'), 'utf8')); } catch { return []; }
}

async function fetchHackathons() {
  let remote = [];
  try { remote = await fetchDevpost(); } catch (e) { console.error('devpost fetch failed', e.message); }
  const local = loadLocal().map((h) => ({ source: 'local', status: 'open', participants: 0, themes: [], ...h }));
  // 참가자 많은 순, 국내(local)는 앞에
  return [...local, ...remote.sort((a, b) => b.participants - a.participants)];
}

module.exports = { fetchHackathons };
