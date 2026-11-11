# 소통

목표: 모든 글에 추천(업)과 이야기.

- 데이터: `data/votes.json`(실시간 증가분), `data/comments.json`(key = 종류:id), `data/feedback.json`
- 화면: 모든 목록과 상세의 업 버튼·이야기 상자
- API: `/api/up/:kind/:id`, `/api/comments/:kind/:id`, 관리자 `/api/admin/comments`
- 전담 에이전트: `market/lib/agents.js`의 `AGENTS.community` (자기 데이터만 읽고, 숫자 → 제안)

규칙
- 한 브라우저가 글 하나에 한 번. 서버는 속도 제한.
- 숨김·삭제는 관리자 → 이야기 관리.

기억 (이 줄기에서 배운 것. 새로 알게 되면 여기에 한 줄씩 더한다)
- (아직 없음)
