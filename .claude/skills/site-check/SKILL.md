---
name: site-check
description: 섬업 사이트를 고친 뒤 깨진 곳이 없는지 확인할 때 쓴다. 서버 재시작, 전체 페이지 오류 점검, 화면 캡처.
---

# 고친 뒤 점검

1. 문법: `node --check market/server.js` 와 고친 `lib/*.js`.
2. 서버 재시작 (이 작업 환경): `cd market && NODE_USE_ENV_PROXY=1 PORT=4000 node server.js` 를 백그라운드로.
3. 전체 페이지 점검: `cd market && node tools/smoke.js` — 모든 줄이 `ok`여야 한다.
4. 화면을 바꿨으면 Playwright로 PC(1280)와 휴대폰(iPhone 13) 화면을 찍어 직접 본다.
5. 시험으로 넣은 댓글·추천은 지운다 (`data/votes.json`은 `{}`로, 댓글은 관리자 API로).
6. 중요한 결정이면 `PROJECT.md`에 번호를 이어 기록하고 커밋·푸시한다.
