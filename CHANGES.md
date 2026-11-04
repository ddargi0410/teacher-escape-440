# 변경 파일과 실행 안내

## 이번 업데이트 · 기초 학습, 휴식, 실제 동시 접속

- **선택형 배움터**: ChatGPT·Claude·Gemini를 고르는 첫걸음부터 말로 요청하기, 코드와 실행, 프롬프트 조립, 오류 수정, 검증, API와 배포까지 여섯 단계. 각 화면에 직접 그린 SVG 삽화와 손으로 눌러 확인하는 시연을 넣었습니다. 실제 AI 호출이나 미션 벌점은 없습니다.
- **보건실**: 1층 별도 공간에 침대 다섯 개. 캐릭터가 누워 숲소리·목탁·무음으로 쉬며, 플레이 시간과 독촉 알림은 정지합니다.
- **함께하기**: 실제 접속 중계 서버를 연결했습니다. 같은 4–24자 방 코드로 최대 30명이 들어가 별명·이동·휴식·인사를 봅니다. 약 1초 간격으로 갱신하며, 미션 진행은 각자 유지합니다. 숨긴 탭은 퇴장을 알리고 비정상 종료는 약 20초 안에 접속 목록에서 만료됩니다.
- **복도 돌발 캐릭터**: F로 말로 진정시키기, G로 만화 효과. 학생·가상 민원 학부모 NPC는 잠시 사라졌다가 현재 층 탐색 시간 20–35초 뒤 재등장합니다. 배움터와 보건실은 돌발 상황이 없는 공간입니다.

### 이번 변경 파일

| 구분 | 파일 |
| --- | --- |
| 추가 | `learning-room.js`, `learning-room.css` |
| 추가 | `rest-room.js`, `rest-room.css` |
| 추가 | `presence.js`, `presence.css`, `presence-config.js`, `campus.css` |
| 수정 | `game.js`, `index.html`, `world.js`, `crowd.js`, `save.js` |
| 추가 검사 | `tests/learning-room.test.mjs`, `tests/rest-room.test.mjs`, `tests/presence.test.mjs`, `tests/wellness-world.test.mjs`, `tests/corridor-combat.test.mjs` |
| 문서 | `README.md`, `CHANGES.md`, `TEACHER-GUIDE.md` |
| 전체 ZIP 추가 파일 | `presence-server-source.zip` — 별도 동시 접속 중계 서버 원본. GitHub Pages 프런트엔드 저장소에는 넣지 않습니다. |

문항·정답·해설은 기존 `missions-data.js`를 유지합니다. 미니게임 전환 범위는 여전히 1–3번이며, 4–10번은 기존 방식입니다. 학습실·보건실·동료 인사는 미션 도장 수를 늘리지 않습니다.

### 서버와 검증

접속 중계 서버: https://teacher-escape-presence.hodumandu.chatgpt.site  
요청 경로: `/api/presence`  
서버 프로젝트: `teacher-escape-presence` (`presence-server-source.zip`에 원본 포함)

AI API 키는 사용하지 않습니다. 게임은 GitHub Pages에서 실행하며, 함께하기를 선택할 때만 공개 중계 주소에 위치·활동 상태를 전송합니다. 게임 검사와 서버 검사는 각각의 프로젝트에서 `node --test tests/*.test.mjs`로 실행합니다. 이번 검사에는 학습 선택·휴식 정지·사운드 정리·접속과 방 격리·세션 소유권·만료·침대와 안전 구역·NPC 재등장이 포함됩니다. 최종 검사 수와 브라우저 확인 결과는 릴리스 안내에 기록합니다.

## 이전 업데이트 · 퇴근톡 독촉 쪽지

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
