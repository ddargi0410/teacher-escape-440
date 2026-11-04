# 변경 파일과 실행 안내

## 이번 업데이트 · 4~10번 미니게임과 교문 보스

- **도서관:** 실제 3D 방에서 단계 책 7권을 주워 순서대로 꽂고 함정 책 1권을 반납합니다. 오답은 책이 튕겨 나오며 다시 시도합니다.
- **컴퓨터실:** 모니터 6대에서 벌레 3마리를 찾고 증상·기대·오류 메시지·범위 조각을 맞춥니다. 드래그·순서 클릭·숫자 키를 지원합니다.
- **과학실:** 9개 문장 방울 중 틀린 문장만 긋고 맞는 것은 바구니로 보냅니다. 오답 문장은 다시 나옵니다.
- **행정실:** 11개 물건을 통과·가상 예시 대체·압수로 분류합니다. 가명 도장은 실제 정보를 받기 전 입력칸을 바꾸는 연습이며, 실제 명단·상담 기록은 압수입니다.
- **방송실:** 현장 입력 소스 확인 후 작은 글씨·배경색·소리 버튼을 칩 하나씩으로 고칩니다. 겹친 수정과 모호한 요청에는 잡음이 생기고, 고친 뒤 10초 안에 저장합니다. 전체 시도는 최대 80초입니다.
- **급식실:** 처음 40초는 HTML·CSS·JS 식판, 마지막 20초는 배포·콘솔·할루시네이션 등 뜻 맞히기입니다. 각 기본 칸 2개 이상과 보너스 3개 이상이면 완료합니다. 여유 모드는 60초 뒤에도 부족한 항목을 이어서 받습니다.
- **교문:** 실제 3D 교장이 다가오고 프롬프트의 새 조건이 켜질 때마다 뒤로 밀려납니다. 역할·대상·주제·형식·조건·출력 중 **5개 이상**, **최소·최대 글자 수 제한 없음**으로 변경했습니다. 퇴근 버튼을 누르면 교장이 작아지고 교문이 열립니다. 쓴 글은 재도전·나가기에도 보존합니다.
- **공통:** 열 미션 모두 `start({container, data, onWin, onFail})`로 독립 실행합니다. 긴 원문·정답·추가 연습 해설은 모든 노하우 카드와 퇴근 증명서 화면에 연결했습니다. 원형 `missions-data.js`와 `missions-ui.js`는 보존하고 현재 게임은 미니게임 실행기를 사용합니다.

### 이번 변경 파일

| 구분 | 파일 |
| --- | --- |
| 추가 미니게임 | `minigames/m04.js`, `m05.js`, `m06.js`, `m07.js`, `m08.js`, `m09.js`, `m10.js` |
| 추가 표현·해설 | `minigames/stage2-content.js` |
| 실행 연결 | `minigames/content.js`, `minigames/runner.js`, `game.js` |
| 검사 | 새 미니게임·콘텐츠 검사와 기존 실행기·콘텐츠 회귀 검사 |
| 문서 | `README.md`, `TEACHER-GUIDE.md`, `CHANGES.md` |

검사 명령은 `node --test tests/*.test.mjs`입니다. 정답·오답·순서·타이머·재시도·중복 완료 방지·입력과 렌더러 정리·원문 보존·보스 판정과 프롬프트 저장을 검사합니다. 최종 검사 결과와 브라우저 확인 범위는 릴리스 안내에 기록합니다.

기존 GitHub Pages 주소와 접속 중계 서버를 유지합니다. 익명 공유용 별도 배포는 이 변경에 포함되지 않습니다. 이번에는 ZIP을 만들지 않습니다. 아래는 **이전 배포 당시의 기록**이며 당시 ZIP이나 구현 범위는 현재 버전과 다를 수 있습니다.

## 이전 업데이트 · 자동 접속과 채널 이동

- 게임 시작·이어하기 때 코드 입력 없이 채널 1로 자동 연결합니다. 퇴근 증명서 이름 대신 자동 생성한 익명 별명을 사용합니다.
- 채널은 1~10이며 채널마다 접속 정원 30명, 보건실 침대 5개입니다. 처음 들어갈 채널이 30명으로 가득 차면 다음 빈 채널을 찾습니다.
- ‘채널 이동’ 화면에서 각 채널의 접속 인원과 빈 침대를 확인합니다. 현황은 약 8초마다 갱신하고 조회 실패·오래된 데이터는 ‘확인 중’ 또는 ‘—’로 표시합니다.
- 누워 있어도 채널 이동 버튼을 쓸 수 있습니다. 다른 채널을 고르면 일어난 뒤 새 채널의 빈 침대에 다시 눕습니다. 침대가 모두 사용 중이면 채널 선택 화면을 엽니다.
- ‘잠깐 혼자 쉬기’와 ‘다시 함께하기’를 제공합니다. 연결 문제가 있어도 기본 게임과 휴식은 계속됩니다. 미션 진행·점수·저장은 그대로입니다.
- 채널별 현황 API는 공개 채널의 집계 숫자만 반환하며 이름·캐릭터 위치·세션 정보와 비공개 방은 목록에 포함하지 않습니다.

### 당시 변경 파일

| 구분 | 파일 |
| --- | --- |
| 추가 | `channels.js`, `channels-ui.js`, `channels.css` |
| 수정 | `presence.js`, `game.js`, `index.html`, `campus.css` |
| 검사 | `tests/channels.test.mjs`, `tests/channels-ui.test.mjs`, `tests/presence.test.mjs` |
| 문서 | `README.md`, `CHANGES.md`, `TEACHER-GUIDE.md` |
| 별도 서버 수정 | `lib/presence.mjs`, `app/api/presence/route.ts`, `tests/presence.test.mjs`, `app/page.tsx`, `README.md` |

전체 다운로드 파일은 `teacher-escape-440-channels.zip`이며 서버 원본 `presence-server-source.zip`도 포함됩니다. 게임·서버 검사는 각각 `node --test tests/*.test.mjs`로 실행합니다. 채널 자동 입장·전환·정원 초과·실패 후 복구·공개 인원 집계·침대 중복과 만료를 확인하며, 최종 통과 수와 브라우저 결과는 릴리스 안내에 기록합니다. 기존 미션 문항과 정답은 변경하지 않습니다.

## 이전 업데이트 · 기초 학습, 휴식, 실제 동시 접속

- **선택형 배움터**: ChatGPT·Claude·Gemini를 고르는 첫걸음부터 말로 요청하기, 코드와 실행, 프롬프트 조립, 오류 수정, 검증, API와 배포까지 여섯 단계. 각 화면에 직접 그린 SVG 삽화와 손으로 눌러 확인하는 시연을 넣었습니다. 실제 AI 호출이나 미션 벌점은 없습니다.
- **보건실**: 1층 별도 공간에 침대 다섯 개. 캐릭터가 누워 숲소리·목탁·무음으로 쉬며, 플레이 시간과 독촉 알림은 정지합니다.
- **함께하기**: 실제 접속 중계 서버를 연결했습니다. 같은 4–24자 방 코드로 최대 30명이 들어가 별명·이동·휴식·인사를 봅니다. 약 1초 간격으로 갱신하며, 미션 진행은 각자 유지합니다. 숨긴 탭은 퇴장을 알리고 비정상 종료는 약 20초 안에 접속 목록에서 만료됩니다.
- **복도 돌발 캐릭터**: F로 말로 진정시키기, G로 만화 효과. 학생·가상 민원 학부모 NPC는 잠시 사라졌다가 현재 층 탐색 시간 20–35초 뒤 재등장합니다. 배움터와 보건실은 돌발 상황이 없는 공간입니다.

### 당시 변경 파일

| 구분 | 파일 |
| --- | --- |
| 추가 | `learning-room.js`, `learning-room.css` |
| 추가 | `rest-room.js`, `rest-room.css` |
| 추가 | `presence.js`, `presence.css`, `presence-config.js`, `campus.css` |
| 수정 | `game.js`, `index.html`, `world.js`, `crowd.js`, `save.js` |
| 추가 검사 | `tests/learning-room.test.mjs`, `tests/rest-room.test.mjs`, `tests/presence.test.mjs`, `tests/wellness-world.test.mjs`, `tests/corridor-combat.test.mjs` |
| 문서 | `README.md`, `CHANGES.md`, `TEACHER-GUIDE.md` |
| 전체 ZIP 추가 파일 | `presence-server-source.zip` — 별도 동시 접속 중계 서버 원본. GitHub Pages 프런트엔드 저장소에는 넣지 않습니다. |

문항·정답·해설은 기존 `missions-data.js`를 유지했습니다. **당시** 미니게임 전환 범위는 1–3번이었고, 4–10번은 원형 퀴즈였습니다. 현재는 모두 미니게임으로 바뀌었습니다. 학습실·보건실·동료 인사는 미션 도장 수를 늘리지 않습니다.

### 서버와 검증

접속 중계 서버: https://teacher-escape-presence.hodumandu.chatgpt.site  
요청 경로: `/api/presence`  
서버 프로젝트: `teacher-escape-presence` (`presence-server-source.zip`에 원본 포함)

AI API 키는 사용하지 않습니다. 당시 버전은 함께하기를 선택할 때만 공개 중계 주소에 위치·활동 상태를 전송했습니다. 현재 버전은 게임 시작 시 자동 연결하며 채널 화면에서 혼자 플레이하도록 전환합니다. 게임 검사와 서버 검사는 각각의 프로젝트에서 `node --test tests/*.test.mjs`로 실행합니다. 당시 검사에는 학습 선택·휴식 정지·사운드 정리·접속과 방 격리·세션 소유권·만료·침대와 안전 구역·NPC 재등장이 포함됩니다. 최종 검사 수와 브라우저 확인 결과는 릴리스 안내에 기록합니다.

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

### 당시 유지한 범위

- missions-data.js와 missions-ui.js 원본 그대로 유지
- 당시 4~10번 미션은 기존 방식 그대로 유지
- 당시 미니게임은 1~3번만 구현했으며 m04.js~m10.js는 없었음
- 저장 키 유지: 이미 완료한 미션은 카드가 열리므로 새 미니게임을 체험하려면 새 게임을 시작하세요.

### 당시 변경된 파일

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

### 당시 검증

자동 검사 41개 통과. 원문 보존·게임 3종 정답/오답/재시도/시간 제한/완료 1회/종료 후 입력 제거, 경로 충돌·기둥 차폐·비활성 층 정지와 기존 미션을 포함합니다.
브라우저에서는 호환 3D 모드로 미니게임 세 화면과 진입·퇴장, OX 정답 진행, 카드 받기를 확인했습니다. 실제 학교 PC의 WebGL과 태블릿 터치는 별도 기기 확인이 필요합니다.
