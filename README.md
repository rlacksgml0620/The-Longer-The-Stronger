# The Longer The Stronger

영어 이름이 길수록 강한 동물 배틀 게임. 속(genus)마다 영어 일반명이 가장 긴 종 하나가 대표로 들어가 있습니다. (13,569속, 출처: Wikidata CC0)

## 로컬 실행
```
npm install
npm start
```
→ http://localhost:3000 (같은 와이파이의 다른 기기는 `http://<내 PC IP>:3000`)

## Render 배포
1. 이 폴더를 GitHub 저장소로 push
2. Render → New → Blueprint → 저장소 선택 (`render.yaml` 자동 인식)
   - 또는 New → Web Service: Build `npm install`, Start `npm start`
3. 배포된 주소를 친구들과 공유하고 방 코드로 입장

## 규칙
- 파워 = 영어 이름의 알파벳 글자 수 (공백·하이픈·아포스트로피 제외)
- 능력치: HP = 80 + 6×글자, 공격 = 6 + 글자, 속도는 짧은 이름이 약간 빠름
- 뽑기: 1회 100 / 10회 1000 (15글자+ 1장 보장). 개별 확률 ∝ 0.85^글자
- 천장: 50회마다 동물 팩 (20글자 이상 3마리)
- AI 배틀(1:1): 쉬움 60 / 보통 120 / 어려움 250 / 지옥 500, 패배 10
- 멀티(방 코드, 2–4인 난전): 2인 200/50 · 3인 300/120/40 · 4인 400/200/100/30
- 진행 상황(코인, 보유 동물)은 브라우저 localStorage에 저장

## 파일
- `server.js` — 정적 파일 + Socket.IO 방/배틀 서버
- `public/engine.js` — 배틀·뽑기 규칙 (서버/클라이언트 공용)
- `public/app.js`, `index.html`, `style.css` — 게임 화면
- `public/animals.json` — 게임용 DB, `data/animals.csv|json` — 같은 DB의 보기용 사본
- `tools/` — DB 생성 스크립트 (QLever Wikidata 엔드포인트 사용)
