# 길잡이 대문

작업을 시작하면 **해당 줄기의 길잡이 파일 하나만** 읽는다. 저장소 전체를 훑지 않는다 (토큰 절약).

| 줄기 | 길잡이 | 한 줄 |
|---|---|---|
| 거래 (본업) | [deal.md](deal.md) | AI 서비스·해커톤 프로젝트 거래, 집·물건 장터, 지도 |
| 창업정보 | [program.md](program.md) | 지원사업·자금 공고, 진행/완료 |
| 인사이트 | [insight.md](insight.md) | 논문·통계·정책·읽을거리 |
| 해커톤 | [hackathon.md](hackathon.md) | 열린 해커톤 일정, 수상작 도감 |
| 소통 | [community.md](community.md) | 추천(업), 이야기(댓글), 제보 |
| 제주살이 | [life.md](life.md) | 생활정보, 버리는 법, 여행 장소 |
| 협업 | [partner.md](partner.md) | 기관 링크, 광고 자리, 제안서 |

공통으로 알아야 할 것
- 공통 화면 부품과 메뉴: `market/public/app.js` (업 버튼 `upBtn`, 순위 줄 `rankRow`, 이야기 `mountComments`, 메뉴 `PRIMARY`)
- 디자인 토큰: `market/public/style.css` 맨 위 `:root`
- 서버: `market/server.js` 하나. 데이터는 `market/data/*.json`
- 관리자: `market/public/admin.html`, 본부: `market/public/hq.html` + `market/lib/agents.js`
- 반복 작업은 `.claude/skills/`의 스킬을 쓴다: `add-public-api`, `add-content`, `site-check`
- 결정 기록은 `PROJECT.md` 맨 끝에 번호를 이어 쓴다
