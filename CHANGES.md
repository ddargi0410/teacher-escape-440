# 변경 파일과 실행 안내

## 이번 업데이트 · 퇴근톡 독촉 쪽지

미완료 미션을 골라 독촉하는 가상 학교 메신저를 추가했습니다. 20개 문구를 돌아가며 사용하며, 완료한 업무는 다시 독촉하지 않습니다. 방송실 문구에는 행사 당일 장비가 갑자기 안 되는 상황을 반영했습니다.

- 추가: `messenger.js`, `messenger.css`, `messenger-data.js`, `messenger-scheduler.js`
- 추가: `tests/messenger.test.mjs`, `tests/messenger-view.test.mjs`
- 수정: `game.js`, `index.html`, `README.md`, `TEACHER-GUIDE.md`, `CHANGES.md`
- `missions-data.js`, `missions-ui.js`, 미니게임 1~3 파일과 기존 저장 형식은 그대로 유지했습니다.

탐색 중 18–26초 뒤 첫 쪽지가 뜨며, 닫은 뒤 35–60초 사이 다시 도착합니다. 교감 접촉 알림도 이 창을 사용하고, 15초 이내 연속 발송을 막습니다. ‘1분 뒤’는 교감의 쪽지까지 60초 미룹니다. 미션·메뉴·다른 탭에서는 알림 시간이 정지하고, 쪽지를 닫거나 무시해도 벌점이 없습니다.

검증: 기존 41개 + 발생 규칙 11개 + 창 동작 7개 = 자동 검사 59개 통과. 브라우저에서 실제 쪽지 표시, 업무 위치 이동, 미니게임 진입 시 숨김을 확인했습니다.

## 이전 업데이트 · 캐릭터와 미니게임 1–3

이번 묶음은 전체 게임입니다. 기존 파일 위에 일부만 덮지 말고 폴더 전체를 사용하세요.
GitHub Pages: 이 폴더 안의 index.html과 vendor/, minigames/ 등을 저장소 루트에 함께 올립니다.
로컬 실행: 폴더에서 `python -m http.server 8000` 실행 후 `http://localhost:8000`에 접속합니다.
HTML 더블클릭 실행은 브라우저의 모듈 보안 제한 때문에 지원되지 않습니다.
게임 실행에는 npm 설치·빌드·AI API 키가 필요하지 않습니다.

## 유지한 범위

- missions-data.js와 missions-ui.js 원본 그대로 유지
- 4~10번 미션은 기존 방식 그대로 유지
- 미니게임은 1~3번만 구현; m04.js~m10.js는 아직 만들지 않음
- 저장 키 유지: 이미 완료한 미션은 카드가 열리므로 새 미니게임을 체험하려면 새 게임을 시작하세요.

## 변경된 파일

- `README.md` (수정)
- `TEACHER-GUIDE.md` (수정)
- `crowd.js` (추가)
- `docs/minigames-preview.jpg` (추가)
- `game.js` (수정)
- `index.html` (수정)
- `minigames/content.js` (추가)
- `minigames/m01.js` (추가)
- `minigames/m02.js` (추가)
- `minigames/m03.js` (추가)
- `minigames/minigames.css` (추가)
- `minigames/runner.js` (추가)
- `minigames/shared.js` (추가)
- `player.js` (수정)
- `style.css` (수정)
- `tests/arcade23.test.mjs` (추가)
- `tests/crowd.test.mjs` (추가)
- `tests/m01.test.mjs` (추가)
- `tests/minigame-content.test.mjs` (추가)
- `tests/minigame-runner.test.mjs` (추가)
- `world-feedback.js` (추가)
- `world.js` (수정)

- `CHANGES.md` (이 변경 목록)

## 검증

자동 검사 41개 통과. 원문 보존·게임 3종 정답/오답/재시도/시간 제한/완료 1회/종료 후 입력 제거, 경로 충돌·기둥 차폐·비활성 층 정지와 기존 미션을 포함합니다.
브라우저에서는 호환 3D 모드로 미니게임 세 화면과 진입·퇴장, OX 정답 진행, 카드 받기를 확인했습니다. 실제 학교 PC의 WebGL과 태블릿 터치는 별도 기기 확인이 필요합니다.
