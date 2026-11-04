# 변경 파일과 실행 안내

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
