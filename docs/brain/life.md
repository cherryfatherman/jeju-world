# 제주살이

목표: 도민이 매일 찾는 생활정보.

- 데이터: `data/guides.json`, `data/places.json`(lat/lng), `config.json`의 `jeju`(요일별 배출)
- 화면: `jeju.html`, `guide.html`, `places.html`, `place.html`, `map.html`
- API: `/api/guides`, `/api/places`, `/api/jeju/waste`
- 전담 에이전트: `market/lib/agents.js`의 `AGENTS.life` (자기 데이터만 읽고, 숫자 → 제안)

규칙
- 버리는 법 답변은 기본 지식표(`lib/ai.js`의 WASTE_KB)가 먼저, 없을 때만 AI.
- 생활정보는 출처와 업데이트 날짜를 단다.

기억 (이 줄기에서 배운 것. 새로 알게 되면 여기에 한 줄씩 더한다)
- (아직 없음)
