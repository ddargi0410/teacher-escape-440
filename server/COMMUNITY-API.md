# 운동장 커뮤니티 서버 설명서 (`/api/community`)

출근 코드, 커피나무, 수돗가 퀴즈, 느티나무 쪽지, 다른 기기 이어하기를 서버에 저장하는 부분입니다.
게임(GitHub Pages)은 이미 이 API를 쓰도록 만들어져 있고, 서버가 아직 없으면 **이 기기에만 저장**하는
모드로 자동 전환됩니다. 서버를 붙이면 그 순간부터 모든 기기에서 같은 나무·쪽지를 보고, 기기에만
있던 나무·쪽지·믹스커피는 같은 닉네임으로 처음 출근할 때 서버로 한 번 옮겨집니다.

## ChatGPT에게 이렇게 말하면 됩니다

> 깃허브 `ddargi0410/teacher-escape-440`의 `server/COMMUNITY-API.md` 설명서대로
> 지금 운영 중인 presence 서버에 `/api/community`를 붙여 줘. `server/community-service.mjs`,
> `community/core.js`, `community/filter.js`, `quiz-bank.js` 네 파일은 고치지 말고 그대로 복사해서 쓰고,
> 저장소 어댑터·CORS·관리자 확인·하루 한 번 정리 작업만 추가해 줘. 다 되면
> `https://teacher-escape-presence.hodumandu.chatgpt.site/api/community/status`가
> `{"ok":true,"version":1,...}`를 돌려주는지 확인해 줘.

## 1. 복사할 파일 (수정 금지)

| 파일 | 역할 |
| --- | --- |
| `server/community-service.mjs` | 라우터·로그인·저장 (프레임워크 없음) |
| `community/core.js` | 게임 규칙 (브라우저와 서버가 같은 파일 사용) |
| `community/filter.js` | 전화번호·이메일·학교 이름·학년 반 이름·욕설 차단 |
| `quiz-bank.js` | 60문제, 한국 시간 날짜로 오늘의 문제 결정 |

폴더 구조를 그대로 유지하세요. `community-service.mjs`는 `../community/core.js`와 `../quiz-bank.js`를
상대 경로로 불러옵니다. Node 18 이상, 외부 패키지 없음(`node:crypto`만 사용).

## 2. 서버에 연결하기

`/api/community`로 시작하는 요청을 아래처럼 넘기면 됩니다. `path`는 `/api/community` **뒤** 부분입니다.

```js
import {createCommunityService} from './server/community-service.mjs';

const community = createCommunityService({
  store: kv,                                  // 아래 3번의 저장소 어댑터
  isAdmin: request => isAdminSession(request), // 기존 /admin 비밀번호 세션 재사용
});

// 기존 HTTP 핸들러 안에서
if (url.pathname.startsWith('/api/community')) {
  if (req.method === 'OPTIONS') return sendCors(res, 204);   // 사전 요청
  const {status, body} = await community.handle({
    method: req.method,
    path: url.pathname.slice('/api/community'.length) || '/',
    query: Object.fromEntries(url.searchParams),
    headers: lowerCaseHeaders(req.headers),   // authorization, cookie 등
    body: await readJson(req),                // 본문이 없으면 undefined
  });
  return sendJson(res, status, body);         // CORS 헤더 포함
}

// 하루 한 번 (예: 한국 시간 새벽 4시): 1년 동안 출근하지 않은 계정과 그 나무·쪽지를 지웁니다.
setInterval(() => community.cleanup(), 24 * 60 * 60 * 1000);
```

### CORS (꼭 필요)

게임은 `https://ddargi0410.github.io`에서 열리고 `Authorization: Bearer …`와
`Content-Type: application/json`을 보내므로 브라우저가 사전 요청(OPTIONS)을 먼저 보냅니다.

```
Access-Control-Allow-Origin: https://ddargi0410.github.io
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 600
```

게임은 쿠키를 보내지 않습니다(`credentials: 'omit'`). 로그인은 Bearer 토큰만 씁니다.

## 3. 저장소 어댑터 (키-값 4개 함수)

어떤 DB든 아래 네 함수만 있으면 됩니다. 값은 JSON 객체입니다.

```js
const kv = {
  async get(key) {},          // 없으면 null
  async set(key, value) {},
  async delete(key) {},
  async list(prefix) {},      // prefix로 시작하는 모든 값의 배열 (키 말고 값)
};
```

| 키 | 내용 |
| --- | --- |
| `account:<닉네임 키>` | 닉네임, 출근 코드 해시(scrypt+salt), 잠금, 믹스커피, 물뿌리개, 받은 알림, 다른 기기 이어하기용 진행 기록(최대 64KB) |
| `accountid:<id>` | id → 닉네임 키 |
| `session:<토큰>` | 로그인 세션 (120일) |
| `tree:<계정 id>` | 계정당 커피나무 1그루 |
| `note:<id>` | 느티나무 쪽지 |

테스트·개발용으로 `createMemoryStore()`가 들어 있습니다(재시작하면 사라짐).

## 4. 엔드포인트

모든 응답은 JSON입니다. 실패하면 `{"error":"코드","message":"한국어 안내"}`와 4xx 상태를 돌려주고,
게임은 `message`를 그대로 보여 줍니다. 🔒는 `Authorization: Bearer <token>` 필요.

| 요청 | 설명 |
| --- | --- |
| `GET /status` | 서버 확인. `{ok, version:1, today, quizIndex, quizCount}` — 게임이 이걸로 서버 모드를 켭니다 |
| `POST /login` `{nickname, code}` | 처음이면 계정 생성, 아니면 코드 확인. 5번 틀리면 10분 잠금(423 `locked`, `retryAt`). 틀리면 403 `wrong_code`, `remaining`. 성공 시 `{token, created, account, save, importedLocal}` |
| 🔒 `POST /logout` | 세션 종료 |
| 🔒 `GET /me` | 내 요약·내 나무·새 알림(물방울 하트·믹스커피 선물·쪽지 반응) |
| 🔒 `PUT /save` `{state}` | 진행 기록 저장(다른 PC·휴대폰 이어하기). 64KB 초과 시 413 |
| `GET /quiz` | 오늘의 문제 번호 (한국 시간 날짜 기준, 모두 같은 문제) |
| 🔒 `POST /quiz/answer` `{questionId, choice}` | 맞히면 물뿌리개 가득(내 나무 1번 + 다른 나무 5그루). 틀리면 해설, 바로 재도전 가능 |
| `GET /trees` | 밭에 보일 최대 60그루 (내 나무 먼저, 나머지는 최근 활동 순) |
| `GET /trees/search?q=` | 이름표·닉네임 검색 |
| 🔒 `POST /trees` `{name}` | 내 커피나무 심기 (이름표 12자, 차단어 검사) |
| 🔒 `POST /trees/:id/water` | 내 나무: 하루 한 단계 성장. 남의 나무: 물방울 하트 (하루 5그루) |
| 🔒 `POST /trees/mine/harvest` | 빨간 열매 수확 → 믹스커피 `1 + 하트 3개마다 1` (최대 5) |
| 🔒 `POST /trees/:id/gift` | 다른 선생님 나무에 믹스커피 선물 → 받는 사람 알림 |
| 🔒 `POST /trees/:id/report` | 이름표 신고 (서로 다른 3명이면 이름표 자동 숨김) |
| `GET /notes?order=latest\|random&offset&limit` | 쪽지 읽기 + 나무 장식 정보(`decor`: 매달 개수 최대 300, 100장 넘으면 꼬마전구, 500장 넘으면 나무 커짐) |
| 🔒 `POST /notes` `{text, color}` | 쪽지 쓰기 (80자, 5색, 하루 3장, 차단어 검사) |
| 🔒 `DELETE /notes/:id` | 내 쪽지 지우기 |
| 🔒 `POST /notes/:id/react` `{type}` | 🙋 `me_too` / 🤗 `pat` / 🏃 `go_home` (누르면 켜고 다시 누르면 끔) |
| 🔒 `POST /notes/:id/report` | 쪽지 신고 (3명이면 자동 숨김) |
| 🔒 `POST /coffee/use` `{target}` | `mentor`(학년 연구실 부장님께) 또는 `rest`(보건실에서 마시기) |
| 🔒 `POST /import` | 기기에만 있던 나무·쪽지·믹스커피를 계정당 한 번 옮기기 |
| 🔒 `DELETE /me` | 내 운동장 기록 전부 지우기 (게임 일시정지 메뉴 ‘내 운동장 기록 지우기’) |
| 관리자 `GET /admin/reports` | 신고된·숨겨진 쪽지와 이름표 목록 |
| 관리자 `POST /admin/notes/:id/hide\|unhide\|delete` | 쪽지 숨김·숨김 해제(신고 초기화)·삭제 |
| 관리자 `POST /admin/trees/:id/hide-name\|unhide-name\|delete` | 이름표 숨김·해제·나무 삭제 |

### 서버가 직접 확인하는 제한

물 주기 횟수, 하루 쪽지 3장, 다른 나무 5그루, 수확량, 선물할 믹스커피 수, 차단어, 신고 3회 숨김,
출근 코드 5회 잠금은 모두 서버에서 다시 검사합니다. 브라우저를 조작해도 넘을 수 없습니다.

## 5. 개발자용 화면(/admin)에 붙일 것

`isAdmin(request)`는 지금 `/admin` 비밀번호로 만든 세션(쿠키 등)을 그대로 확인하면 됩니다.
`server/community-admin-panel.html`은 같은 출처의 `/admin` 페이지 안에 넣을 수 있는 작은 화면입니다.
신고된 쪽지·이름표를 보고 숨김 해제·삭제 버튼을 누를 수 있습니다.

## 6. 보관 기간과 삭제 (시작 화면에 안내됨)

- 커피나무·쪽지·출근 코드: 마지막 출근 후 **1년** 보관, `cleanup()`이 하루 한 번 정리
- 선생님 본인 삭제: 게임 일시정지 메뉴 → ‘내 운동장 기록 지우기’ (`DELETE /me`)
- 운영자 삭제: 개발자용 화면 또는 `POST /admin/...`
- 출근 코드는 scrypt 해시로만 저장하고 원문은 저장하지 않습니다

## 7. 확인 방법

```bash
node --test tests/community.test.mjs   # 규칙·필터·서버·클라이언트·이전·관리자 검사
```

배포 후 `GET /api/community/status`가 `version: 1`을 돌려주면 게임은 다음 접속부터 자동으로 서버 모드가 됩니다.
