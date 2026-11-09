# 바톤 (Baton)

해커톤의 바통을 다음 주자에게. AI로 만든 서비스와 해커톤 프로젝트를 다음 주인에게 넘기는 장터.

## 실행
```bash
npm install
node server.js        # http://localhost:4000
```
- AI 소개글: `GEMINI_API_KEY` 환경변수에 Google AI Studio 키를 넣으면 작동. 없으면 기본 초안으로 자동 전환.
- 프록시 환경(클라우드 세션)에서는 `NODE_USE_ENV_PROXY=1 node server.js`.
- 데이터는 `data/*.json` 파일에 저장. `inquiries.json`, `waitlist.json`은 커밋하지 않음.
- 해커톤 일정은 Devpost 공개 API에서 6시간마다 자동 수집, 국내 대회는 `data/hackathons.local.json`에 직접 추가.

## 관리자 화면
- 주소: `/admin.html` — 문구·색·메뉴·공지 띠·도구 상자·예시 표시 여부를 고치고 "저장"하면 바로 반영.
- 비밀번호 기본값: `baton1234`. **배포할 때는 환경변수 `ADMIN_PASSWORD`로 꼭 바꾸세요.**
- 설정은 `config.json` 한 파일에 저장됨. GitHub에서 직접 고쳐도 됨.
