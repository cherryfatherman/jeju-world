---
name: add-public-api
description: 섬업에 공공데이터 API(또는 다른 외부 데이터)를 자동 갱신 피드로 붙일 때 쓴다. 공공데이터포털, K-Startup, 관광 API, 기상청, 응급의료 등.
---

# 공공 API를 자동 갱신 피드로 붙이기

목표: 데이터는 코드가 받아오고 저장한다. AI 토큰은 쓰지 않는다.

1. `docs/ops/apis.md`에서 대상 API와 상태를 확인한다. 키 이름은 `market/.env.example`에 칸을 만든다. 진짜 키는 `.env`에만.
2. `market/server.js`에 `async function refreshXxx()`를 쓴다.
   - 키는 `process.env`에서 읽고 응답·로그·화면에 내보내지 않는다.
   - 받아온 글에는 `auto: true`, `externalId`를 넣는다.
   - 기존 파일의 손으로 쓴 글과 `hidden` 표시는 지킨다 (`refreshKStartup` 참고).
   - 응답 형식이 불확실하면 필드 이름을 너그럽게 받는다.
3. `FEEDS`에 한 줄 추가한다: `{ name, every, needs, run }`. 관리자 → 자동 갱신 탭에 저절로 나온다.
4. 해당 줄기의 전담 에이전트(`market/lib/agents.js`)가 피드 상태를 보고 제안하게 한다.
5. 작업 환경에서 호출이 막히면 시험하지 못했다고 분명히 적고, 사용자가 '지금 갱신'으로 확인하게 안내한다.
6. `docs/ops/apis.md` 상태 칸과 해당 줄기 길잡이(`docs/brain/*.md`)를 고친다.
