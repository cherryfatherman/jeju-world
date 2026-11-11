---
name: add-content
description: 섬업에 지원사업 공고, 인사이트(논문·통계·정책), 생활정보, 여행 장소 같은 사실 정보를 추가하거나 고칠 때 쓴다.
---

# 사실 정보 추가·수정

1. 줄기 길잡이를 읽는다: `docs/brain/program.md`, `insight.md`, `life.md` 중 하나.
2. 출처를 먼저 찾는다. 공식 공고·보도·논문 페이지의 링크가 없으면 올리지 않는다.
3. 숫자(금액·금리·기간)는 출처에 있는 것만 쓴다. 출처마다 다르면 쓰지 않고 "공고 원문에서 확인"으로 둔다.
4. 화면에 '확인 필요' 같은 표시를 쓰지 않는다. 대신 `updatedAt`(또는 `lastChecked`)과 출처 링크를 넣는다.
5. 글은 짧게: 요약 한 줄, 핵심 3개 이하. 사진은 무료 라이선스(Unsplash·Pexels)만, 주제에 맞는지 눈으로 확인한다.
6. 데이터 파일 형식은 기존 글을 그대로 따른다 (`market/data/programs.json`, `insights.json`, `guides.json`, `places.json`).
7. 끝나면 `site-check` 스킬로 확인한다.
