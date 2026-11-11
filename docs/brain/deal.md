# 거래 (본업)

목표: AI로 만든 서비스와 해커톤 프로젝트가 다음 주인을 만난다. 집·물건 장터는 부가.

- 데이터: `data/projects.json` (type: project/home/item, deal: open/done, area: 거래 지역)
- 화면: `market.html`(거래 목록·진행/완료), `project.html`(상세), `sell.html`(올리기·AI 글쓰기), `map.html`(지도)
- API: `/api/projects`, `/api/generate`, `/api/map`, `/api/regions`, 관리자 `/api/admin/projects/:id`
- 전담 에이전트: `market/lib/agents.js`의 `AGENTS.deal` (자기 데이터만 읽고, 숫자 → 제안)

규칙
- 집 글은 소유자·중개인 확인이 있어야 올라간다. 서류 사진은 분석만 하고 저장하지 않는다.
- 연락처는 문의한 사람에게만 보인다. 공개 API에 넣지 않는다.
- 지도에는 읍·면·동 단위로만 찍는다 (`lib/regions.js`). 정확한 주소를 쓰지 않는다.
- AI 글쓰기는 사용자가 버튼을 눌렀을 때만 부른다.

기억 (이 줄기에서 배운 것. 새로 알게 되면 여기에 한 줄씩 더한다)
- (아직 없음)
