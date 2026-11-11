# 창업정보

목표: 제주에서 받을 수 있는 지원사업·자금을 한곳에.

- 데이터: `data/programs.json` (start/end/always/status, auto: API가 넣은 글)
- 화면: `board.html?kind=program`, `post.html?kind=program&id=`
- API: `/api/posts/program`, 관리자 `/api/admin/posts/program`, 피드 `kstartup`
- 전담 에이전트: `market/lib/agents.js`의 `AGENTS.program` (자기 데이터만 읽고, 숫자 → 제안)

규칙
- 마감일이 지나면 자동으로 완료. 완료 글도 업과 이야기가 된다.
- 금액·금리는 공고 원문에서 확인한 것만 쓴다. 모르면 쓰지 않는다.
- 모든 글에 공고 원문 링크.

기억 (이 줄기에서 배운 것. 새로 알게 되면 여기에 한 줄씩 더한다)
- (아직 없음)
