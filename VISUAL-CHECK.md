# 운동장 · 출근 코드 · 커피나무 · 느티나무 쪽지 — 실제 화면 확인

실제 Chromium 153.0.8010.12 · SwiftShader webgl · 1366×820 / 1024×768 · 118장면 · 콘솔/페이지/빈 화면 오류 0 · 단위 테스트 383개 통과

실행: 2026-11-10T07:02:40.898Z ~ 2026-11-10T07:57:50.295Z (UTC). 이 작업 환경은 CPU가 2개라 두 크기를 `VISUAL_VIEWPORT=laptop`, `VISUAL_VIEWPORT=tablet`으로 나눠 실행했습니다(`npm run visual`은 두 크기를 한 번에 실행).

## 반영 내용

- 새 게임에 숫자 4자리 출근 코드, 첫 화면에 ‘출근 코드로 이어하기’, 일시정지 메뉴에 ‘내 운동장 기록 지우기’를 더했습니다.
- 1층 앞마당 동쪽 아치·🏃 운동장 버튼·지도로 가는 별도 운동장 구역, Space/터치 점프, 수돗가 퀴즈, 생태 밭 커피나무, 느티나무 쪽지 방명록을 추가했습니다.
- 서버 API가 붙기 전에는 이 기기에만 저장한다는 안내가 각 패널에 나옵니다. 시각 검사는 localhost 전용 장면으로 실행하며 실제 방문 통계·닉네임·명예의 전당·서버 기록을 만들지 않습니다(운동장 장면의 커피나무 14그루와 쪽지 128장은 검사용 화면 데이터입니다).

## 동작 검사

- laptop-1366x820 · unfinished-infirmary-quarter-speed · 통과
- laptop-1366x820 · space-jump · 통과
- laptop-1366x820 · yard-entrance-returns-to-school · 통과
- laptop-1366x820 · postgame-normal-clock · 통과
- laptop-1366x820 · postgame-infirmary-quarter-speed · 통과
- laptop-1366x820 · hidden-infirmary-pauses-clock · 통과
- laptop-1366x820 · pause-menu-stops-clock · 통과
- laptop-1366x820 · certificate-revisit-and-direct-rest · 통과
- tablet-1024x768 · unfinished-infirmary-quarter-speed · 통과
- tablet-1024x768 · space-jump · 통과
- tablet-1024x768 · yard-entrance-returns-to-school · 통과
- tablet-1024x768 · postgame-normal-clock · 통과
- tablet-1024x768 · postgame-infirmary-quarter-speed · 통과
- tablet-1024x768 · hidden-infirmary-pauses-clock · 통과
- tablet-1024x768 · pause-menu-stops-clock · 통과
- tablet-1024x768 · certificate-revisit-and-direct-rest · 통과

## 이번 검사에서 고친 것

- 생태 밭 입구 팻말이 뒤를 보고 있어 학교 쪽(도착 방향)으로 돌렸습니다.
- 느티나무 간판이 플레이어 머리에 가려 머리 위 높이로 올리고, 도착 위치를 E가 닿는 거리로 당겼습니다.
- 내 나무로 이동하면 입구 팻말이 플레이어를 가려, 나무 옆 통로에서 입구 쪽을 바라보게 바꿨습니다. 이웃 나무와 E 대상이 겹치지 않도록 상호작용 지점을 나눴습니다.
- 수돗가 퀴즈의 주제 표시(예: ‘CSS’)가 정답을 드러내던 문항 6개의 주제를 바꾸고, 같은 일이 생기지 않게 단위 테스트를 추가했습니다.
- 12자 이름표 칸에서 전화번호 마지막 자리가 잘리면 차단을 피하던 문제를 고쳤습니다(끝자리 3자리·띄어 쓴 번호도 차단).
- 닉네임이 ‘선생님’으로 끝나면 ‘선생님 선생님’으로 보이던 표시를 고쳤습니다.
- 밤 운동장이 너무 어두워 조명탑 아래 바닥 빛과 가로등 머리를 더했습니다. 정답을 고른 보기가 흐리게 보이던 스타일도 고쳤습니다.
- 출근 코드가 틀렸을 때 안내가 화면 위쪽에 있어 보이지 않던 문제를 고쳤습니다(코드 칸으로 이동).
- 1024px 화면에서 E 안내가 하단 버튼 줄·채널 막대와 겹쳐(운동장의 긴 안내에서 두드러짐) 1180px 이하 마우스 화면에서는 두 줄 위로 올렸습니다. 태블릿 크기는 이 수정 뒤 다시 촬영했습니다.

## 장면별 관찰

### laptop-1366x820 · 01-home

층별 색 띠의 학교 외관, ‘게임 시작’과 새 ‘출근 코드로 이어하기’ 버튼이 나란히 보입니다. 하단 안내에 운동장 기록 1년 보관과 지우는 방법이 한 줄로 들어가며 다른 글자와 겹치지 않습니다.

![시작 화면과 학교 전경](screenshots/laptop-1366x820/01-home.png)

### laptop-1366x820 · 02-check-in

닉네임 아래 숫자 4자리 출근 코드 칸(점으로 가림)과 실제 비밀번호를 쓰지 말라는 안내, 캐릭터 카드가 차례로 보입니다. 선택한 카드 테두리가 분명하고 글자 겹침이 없습니다.

![닉네임·출근 코드 입력과 여섯 캐릭터 선택](screenshots/laptop-1366x820/02-check-in.png)

### laptop-1366x820 · 03-first-floor

1층 복도의 플레이어와 학생 NPC, 튜토리얼 카드가 보입니다. 하단 캠퍼스 버튼 줄에 ‘🏃 운동장’이 추가되어도 버튼끼리 겹치지 않습니다.

![1층 허브의 플레이어와 가까운 3인칭 시점](screenshots/laptop-1366x820/03-first-floor.png)

### laptop-1366x820 · 04-walk

W로 2초 걸은 뒤 복도 안쪽과 현관 쪽 창밖이 보입니다. 플레이어가 천장·벽에 가리지 않습니다.

![W로 2초 이동한 뒤의 건물·플레이어·HUD](screenshots/laptop-1366x820/04-walk.png)

### laptop-1366x820 · 05-overview

내려다보기에서 1층 구조, 학생들, 중앙계단과 동상이 보입니다.

![내려다보기 전환 뒤 학교 구조와 플레이어](screenshots/laptop-1366x820/05-overview.png)

### laptop-1366x820 · 06-first-person

1인칭으로 중앙계단 안내판과 비상구 표시, 앞쪽 학생이 보입니다.

![1인칭 전환 뒤 복도와 HUD](screenshots/laptop-1366x820/06-first-person.png)

### laptop-1366x820 · 07-low-quality

저 품질 설정에서 그림자·햇빛 효과가 꺼진 복도와 플레이어가 보입니다.

![실제 설정 메뉴에서 저 품질로 바꾼 복도](screenshots/laptop-1366x820/07-low-quality.png)

### laptop-1366x820 · mission-01-briefing

미션 1 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 1 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-01-briefing.png)

### laptop-1366x820 · mission-01-play

미션 1 3초 플레이: OX 교실 바닥과 칠판 문장, 남은 시간, 방향 버튼이 보입니다.

![미션 1 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-01-play.png)

### laptop-1366x820 · mission-02-briefing

미션 2 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 2 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-02-briefing.png)

### laptop-1366x820 · mission-02-play

미션 2 3초 플레이: 머그컵과 역할·대상·목표·조건·출력 칸, 시간이 보입니다.

![미션 2 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-02-play.png)

### laptop-1366x820 · mission-03-briefing

미션 3 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 3 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-03-briefing.png)

### laptop-1366x820 · mission-03-play

미션 3 3초 플레이: 여섯 전화기와 부재중 표시, 진행 수가 보입니다.

![미션 3 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-03-play.png)

### laptop-1366x820 · mission-04-briefing

미션 4 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 4 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-04-briefing.png)

### laptop-1366x820 · mission-04-play

미션 4 3초 플레이: 책장과 바닥의 책 이름표, 함정 반납함과 E 버튼이 보입니다.

![미션 4 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-04-play.png)

### laptop-1366x820 · mission-05-briefing

미션 5 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 5 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-05-briefing.png)

### laptop-1366x820 · mission-05-play

미션 5 3초 플레이: 모니터 여섯 대 중 벌레가 나온 화면과 진행 수가 보입니다.

![미션 5 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-05-play.png)

### laptop-1366x820 · mission-06-briefing

미션 6 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 6 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-06-briefing.png)

### laptop-1366x820 · mission-06-play

미션 6 3초 플레이: 문장 방울과 좋은 습관/틀린 습관 판단 버튼, 비커가 보입니다.

![미션 6 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-06-play.png)

### laptop-1366x820 · mission-07-briefing

미션 7 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 7 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-07-briefing.png)

### laptop-1366x820 · mission-07-play

미션 7 3초 플레이: 컨베이어 위 ‘가상 이름’ 카드와 통과·가상 예시로·압수 버튼이 보입니다.

![미션 7 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-07-play.png)

### laptop-1366x820 · mission-08-briefing

미션 8 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 8 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-08-briefing.png)

### laptop-1366x820 · mission-08-play

미션 8 3초 플레이: NO SIGNAL 송출 화면과 입력 소스 확인 버튼이 보입니다.

![미션 8 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-08-play.png)

### laptop-1366x820 · mission-09-briefing

미션 9 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 9 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-09-briefing.png)

### laptop-1366x820 · mission-09-play

미션 9 3초 플레이: 내려오는 ‘버튼 색’ 카드와 HTML·CSS·JS 세 칸, 번호 버튼이 보입니다.

![미션 9 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-09-play.png)

### laptop-1366x820 · mission-10-briefing

미션 10 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 10 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-10-briefing.png)

### laptop-1366x820 · mission-10-play

미션 10 3초 플레이: 교문 앞 보스와 방패 여섯 개, 힌트 버튼과 입력 칸·체크리스트가 보입니다.

![미션 10 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-10-play.png)

### laptop-1366x820 · rest-back

보건실 침대에 바로 누운 캐릭터와 호수 창, 옆 침대가 보입니다. 믹스커피가 없으니 ‘믹스커피 마시기’ 버튼은 나오지 않습니다.

![보건실 바로 눕기·침대·화분·호수](screenshots/laptop-1366x820/rest-back.png)

### laptop-1366x820 · rest-reverse

누운 채 반대쪽으로 돌아본 머리·어깨와 화분, 창가가 이어져 보입니다.

![누운 채 반대쪽으로 돌아본 머리·목·어깨 연결](screenshots/laptop-1366x820/rest-reverse.png)

### laptop-1366x820 · rest-eyes

베개 눈높이에서 천장과 창문, 옆 침대 머리맡이 보입니다.

![베개 눈높이에서 본 보건실 천장·창문·옆 침대](screenshots/laptop-1366x820/rest-eyes.png)

### laptop-1366x820 · rest-side

옆으로 누운 자세와 이불, 번호가 붙은 다른 침대가 보입니다.

![보건실 옆으로 눕기·침대·화분·호수](screenshots/laptop-1366x820/rest-side.png)

### laptop-1366x820 · room-classroom

5층 교실 칠판·책상·의자와 미션 01 표식, 상호작용 안내가 보입니다.

![교실 칠판·교탁·사물함·창문](screenshots/laptop-1366x820/room-classroom.png)

### laptop-1366x820 · room-research

학년 연구실 테이블의 믹스커피·간식, 교구장과 미션 02 안내가 보입니다.

![학년 연구실 책상과 생활 소품](screenshots/laptop-1366x820/room-research.png)

### laptop-1366x820 · room-office

교무실 모니터 책상과 미션 03 표식, 쪽지메신저 담당 안내가 보입니다.

![교무실 업무 공간과 가구](screenshots/laptop-1366x820/room-office.png)

### laptop-1366x820 · room-copier

눈 달린 복사기의 찡그린 얼굴과 옆 책상 서류가 보입니다.

![복사기와 주변 서류·용지](screenshots/laptop-1366x820/room-copier.png)

### laptop-1366x820 · room-exterior

중앙현관 캐노피의 ‘퇴근초등학교 중앙 현관’ 간판과 안쪽 복도가 보입니다.

![학교 외벽·창틀·입구와 주변 풍경](screenshots/laptop-1366x820/room-exterior.png)

### laptop-1366x820 · room-broadcast

방송실 ON AIR 표시, 모니터, 마이크, 삼각대 카메라와 NPC가 보입니다.

![방송실 모니터·카메라·방송 장비](screenshots/laptop-1366x820/room-broadcast.png)

### laptop-1366x820 · room-window

투명한 유리창 너머 아파트 단지와 하늘이 보입니다.

![투명 유리창 너머 한국식 아파트와 실제 바깥 공간](screenshots/laptop-1366x820/room-window.png)

### laptop-1366x820 · window-night

밤 창밖 아파트의 켜진 창과 밝게 유지된 실내가 보입니다.

![밤의 실제 창밖 아파트와 밝게 유지된 실내](screenshots/laptop-1366x820/window-night.png)

### laptop-1366x820 · exterior-night

밤 중앙현관과 어두워진 앞마당, 켜진 실내가 보입니다.

![밤의 아파트·운동장·달·가로등](screenshots/laptop-1366x820/exterior-night.png)

### laptop-1366x820 · characters-front

여섯 캐릭터 정면: 눈과 앞머리가 가리지 않고 이름표가 읽힙니다.

![여섯 실제 3D 캐릭터 정면: 눈과 앞머리 확인](screenshots/laptop-1366x820/characters-front.png)

### laptop-1366x820 · characters-quarter

여섯 캐릭터 45°: 귀·목·옆머리가 이어져 보입니다.

![여섯 실제 3D 캐릭터 45°: 얼굴·귀·목·옆머리 확인](screenshots/laptop-1366x820/characters-quarter.png)

### laptop-1366x820 · yard-gate

1층 앞마당 동쪽의 초록 아치 ‘운동장 가는 길 →’과 바닥 화살표, 벤치·울타리가 보입니다. 왼쪽에 명예의 전당 동상 받침이 일부 걸리지만 아치와 플레이어는 가리지 않습니다.

![1층 앞마당 동쪽의 ‘운동장 가는 길’ 아치와 화살표](screenshots/laptop-1366x820/yard-gate.png)

### laptop-1366x820 · yard-arrival

중앙현관 밖 운동장 도착: 마사토 바닥, 흰 선 트랙, 골대, 놀이기구, 스탠드, 가장자리 나무와 조명탑, 오른쪽 느티나무 쪽지와 벤치가 보입니다. ‘학교 안으로’ 상호작용 안내와 HUD ‘운동장’ 표시가 나옵니다.

![중앙현관 밖 운동장 도착: 마사토·트랙·골대·구령대·스탠드](screenshots/laptop-1366x820/yard-arrival.png)

### laptop-1366x820 · yard-school-side

운동장에서 본 학교 외벽과 ‘중앙현관 · 학교 안으로’ 간판, 쪽지가 매달린 느티나무와 벤치, ‘오늘도 무사히 퇴근’ 구령대와 배움·퇴근초·쉼 깃발이 보입니다.

![운동장에서 본 학교 외벽·중앙현관·수돗가·느티나무](screenshots/laptop-1366x820/yard-school-side.png)

### laptop-1366x820 · yard-night

17:40 밤: 달·별, 조명탑 아래 밝은 바닥, 가로등과 느티나무 꼬마전구가 켜집니다. 어두운 바닥 위에서도 플레이어와 HUD가 읽힙니다.

![밤 운동장: 조명탑·달·별, 느티나무 꼬마전구](screenshots/laptop-1366x820/yard-night.png)

### laptop-1366x820 · faucet

시멘트 수돗가와 스테인리스 수도꼭지 여섯 개, ‘수돗가 · 오늘의 퀴즈 맞히고 물 받기’ 간판과 상호작용 안내가 보입니다.

![수돗가 스테인리스 수도꼭지와 시멘트 개수대](screenshots/laptop-1366x820/faucet.png)

### laptop-1366x820 · faucet-panel

오늘의 퀴즈: 날짜·문제 번호, 주제 표시, 문제와 세 보기가 겹침 없이 보입니다. 주제 표시가 정답 보기를 드러내지 않습니다.

![오늘의 퀴즈 문제와 세 가지 보기](screenshots/laptop-1366x820/faucet-panel.png)

### laptop-1366x820 · farm

생태 밭 입구 팻말(학교 쪽을 향함), 나무 울타리와 흙 두둑, 내 나무 자리의 노란 고리, 여러 단계의 커피나무와 이름표가 보입니다.

![생태 밭 입구·나무 울타리·팻말과 커피나무들](screenshots/laptop-1366x820/farm.png)

### laptop-1366x820 · farm-panel

내 커피나무 카드(이름표·5단계 표시·물 주기 상태), 가방 속 믹스커피, 이름표 검색과 기기 저장 안내가 보입니다.

![내 커피나무 성장 단계와 나무 찾기](screenshots/laptop-1366x820/farm-panel.png)

### laptop-1366x820 · zelkova

느티나무와 머리 위 ‘느티나무 쪽지 방명록’ 간판, 매달린 쪽지, 양쪽 벤치와 가로등이 보입니다. 간판을 머리 위로 올려 플레이어가 가리지 않습니다.

![느티나무·벤치와 매달린 쪽지](screenshots/laptop-1366x820/zelkova.png)

### laptop-1366x820 · zelkova-panel

민트색 쪽지 한 장, 작성자 표시(‘선생님’ 한 번만), 🙋 🤗 🏃 반응 버튼과 내 쪽지 지우기, 안내가 보입니다.

![쪽지 읽기·반응 버튼](screenshots/laptop-1366x820/zelkova-panel.png)

### laptop-1366x820 · ending

퇴근 엔딩 뒤 증명서 첫 화면: 퇴근 시각 16:42, 야근 2분과 선택 버튼이 보입니다.

![실제 퇴근 엔딩 장면](screenshots/laptop-1366x820/ending.png)

### laptop-1366x820 · certificate

증명서 제목이 화면 안에 있고 닉네임·퇴근 시각·야근 시간이 크게 보입니다.

![퇴근 증명서의 닉네임·퇴근 시각·야근 시간](screenshots/laptop-1366x820/certificate.png)

### laptop-1366x820 · certificate-export

내려받은 증명서 PNG에 닉네임·퇴근 시각·야근 시간·노하우 10가지가 들어 있습니다.

![실제 저장 버튼으로 내려받은 퇴근 증명서 PNG](screenshots/laptop-1366x820/certificate-export.png)

### laptop-1366x820 · certificate-choices

학교에 남아 놀기·보건실에서 쉬기, 실제 플레이 시간과 노하우 10/10이 보입니다.

![증명서 저장·학교에 남기·보건실에서 쉬기 선택](screenshots/laptop-1366x820/certificate-choices.png)

### laptop-1366x820 · after-certificate-hub

퇴근 후 1층으로 돌아와 10/10 결재와 자유시간 시계가 보입니다.

![퇴근 기록을 유지한 채 학교에 돌아온 캐릭터와 자유시간 HUD](screenshots/laptop-1366x820/after-certificate-hub.png)

### laptop-1366x820 · after-certificate-rest

퇴근 후 보건실에 다시 누워 학교 시계가 ¼ 속도로 흐릅니다.

![퇴근 후 다시 누운 보건실과 천천히 흐르는 시계](screenshots/laptop-1366x820/after-certificate-rest.png)

### laptop-1366x820 · certificate-revisited

자유시간 뒤 다시 연 증명서에 처음 퇴근 시각과 야근 시간이 그대로입니다.

![자유시간 뒤 다시 연 증명서: 처음 퇴근 시각과 야근 시간 유지](screenshots/laptop-1366x820/certificate-revisited.png)

### tablet-1024x768 · 01-home

좁은 화면에서도 ‘게임 시작’ 아래 ‘출근 코드로 이어하기’가 이어지고, 하단 보관 안내가 한 줄 안에 들어갑니다.

![시작 화면과 학교 전경](screenshots/tablet-1024x768/01-home.png)

### tablet-1024x768 · 02-check-in

캐릭터를 고른 뒤 패널이 조금 내려가 있지만 닉네임·출근 코드 칸, 안내, 캐릭터 카드가 모두 읽힙니다.

![닉네임·출근 코드 입력과 여섯 캐릭터 선택](screenshots/tablet-1024x768/02-check-in.png)

### tablet-1024x768 · 03-first-floor

1층 복도의 플레이어와 학생 NPC, 튜토리얼 카드가 보입니다. 하단 캠퍼스 버튼 줄에 ‘🏃 운동장’이 추가되어도 버튼끼리 겹치지 않습니다.

![1층 허브의 플레이어와 가까운 3인칭 시점](screenshots/tablet-1024x768/03-first-floor.png)

### tablet-1024x768 · 04-walk

W로 2초 걸은 뒤 복도 안쪽과 현관 쪽 창밖이 보입니다. 플레이어가 천장·벽에 가리지 않습니다.

![W로 2초 이동한 뒤의 건물·플레이어·HUD](screenshots/tablet-1024x768/04-walk.png)

### tablet-1024x768 · 05-overview

내려다보기에서 1층 구조, 학생들, 중앙계단과 동상이 보입니다.

![내려다보기 전환 뒤 학교 구조와 플레이어](screenshots/tablet-1024x768/05-overview.png)

### tablet-1024x768 · 06-first-person

1인칭으로 중앙계단 안내판과 비상구 표시, 앞쪽 학생이 보입니다.

![1인칭 전환 뒤 복도와 HUD](screenshots/tablet-1024x768/06-first-person.png)

### tablet-1024x768 · 07-low-quality

저 품질 설정에서 그림자·햇빛 효과가 꺼진 복도와 플레이어가 보입니다.

![실제 설정 메뉴에서 저 품질로 바꾼 복도](screenshots/tablet-1024x768/07-low-quality.png)

### tablet-1024x768 · mission-01-briefing

미션 1 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 1 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-01-briefing.png)

### tablet-1024x768 · mission-01-play

미션 1 3초 플레이: OX 교실 바닥과 칠판 문장, 남은 시간, 방향 버튼이 보입니다.

![미션 1 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-01-play.png)

### tablet-1024x768 · mission-02-briefing

미션 2 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 2 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-02-briefing.png)

### tablet-1024x768 · mission-02-play

미션 2 3초 플레이: 내려오는 카드 세 장, 머그컵, 역할 칸에 받은 ‘과학 웹 개발 도우미’가 겹침 없이 보입니다.

![미션 2 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-02-play.png)

### tablet-1024x768 · mission-03-briefing

미션 3 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 3 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-03-briefing.png)

### tablet-1024x768 · mission-03-play

미션 3 3초 플레이: 여섯 전화기와 부재중 표시, 진행 수가 보입니다.

![미션 3 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-03-play.png)

### tablet-1024x768 · mission-04-briefing

미션 4 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 4 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-04-briefing.png)

### tablet-1024x768 · mission-04-play

미션 4 3초 플레이: 책장과 바닥의 책 이름표, 함정 반납함과 E 버튼이 보입니다.

![미션 4 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-04-play.png)

### tablet-1024x768 · mission-05-briefing

미션 5 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 5 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-05-briefing.png)

### tablet-1024x768 · mission-05-play

미션 5 3초 플레이: 모니터 여섯 대 중 벌레가 나온 화면과 진행 수가 보입니다.

![미션 5 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-05-play.png)

### tablet-1024x768 · mission-06-briefing

미션 6 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 6 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-06-briefing.png)

### tablet-1024x768 · mission-06-play

미션 6 3초 플레이: 문장 방울과 좋은 습관/틀린 습관 판단 버튼, 비커가 보입니다.

![미션 6 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-06-play.png)

### tablet-1024x768 · mission-07-briefing

미션 7 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 7 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-07-briefing.png)

### tablet-1024x768 · mission-07-play

미션 7 3초 플레이: 컨베이어 위 ‘가상 이름’ 카드와 통과·가상 예시로·압수 버튼이 보입니다.

![미션 7 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-07-play.png)

### tablet-1024x768 · mission-08-briefing

미션 8 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 8 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-08-briefing.png)

### tablet-1024x768 · mission-08-play

미션 8 3초 플레이: NO SIGNAL 송출 화면과 입력 소스 확인 버튼이 보입니다.

![미션 8 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-08-play.png)

### tablet-1024x768 · mission-09-briefing

미션 9 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 9 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-09-briefing.png)

### tablet-1024x768 · mission-09-play

미션 9 3초 플레이: 내려오는 ‘버튼 색’ 카드와 HTML·CSS·JS 세 칸, 번호 버튼이 보입니다.

![미션 9 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-09-play.png)

### tablet-1024x768 · mission-10-briefing

미션 10 시작 안내: 공통 과제(초등 5학년 먹이사슬), 지금 할 일, 조작 3단계, 완료 조건과 시작 버튼이 겹침 없이 보입니다.

![미션 10 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-10-briefing.png)

### tablet-1024x768 · mission-10-play

미션 10 3초 플레이: 교문 앞 보스와 방패 여섯 개, 힌트 버튼과 입력 칸·체크리스트가 보입니다.

![미션 10 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-10-play.png)

### tablet-1024x768 · rest-back

보건실 침대에 바로 누운 캐릭터와 호수 창, 옆 침대가 보입니다. 믹스커피가 없으니 ‘믹스커피 마시기’ 버튼은 나오지 않습니다.

![보건실 바로 눕기·침대·화분·호수](screenshots/tablet-1024x768/rest-back.png)

### tablet-1024x768 · rest-reverse

누운 채 반대쪽으로 돌아본 머리·어깨와 화분, 창가가 이어져 보입니다.

![누운 채 반대쪽으로 돌아본 머리·목·어깨 연결](screenshots/tablet-1024x768/rest-reverse.png)

### tablet-1024x768 · rest-eyes

베개 눈높이에서 천장과 창문, 옆 침대 머리맡이 보입니다.

![베개 눈높이에서 본 보건실 천장·창문·옆 침대](screenshots/tablet-1024x768/rest-eyes.png)

### tablet-1024x768 · rest-side

옆으로 누운 자세와 이불, 번호가 붙은 다른 침대가 보입니다.

![보건실 옆으로 눕기·침대·화분·호수](screenshots/tablet-1024x768/rest-side.png)

### tablet-1024x768 · room-classroom

5층 교실 칠판·책상·의자와 미션 01 표식, E 안내가 하단 막대 위에 보입니다.

![교실 칠판·교탁·사물함·창문](screenshots/tablet-1024x768/room-classroom.png)

### tablet-1024x768 · room-research

연구실 테이블과 교구장. 이전 검사에서 채널 막대가 ‘살펴보기’ 버튼 끝을 조금 덮던 것을 E 안내를 올려 해결했습니다.

![학년 연구실 책상과 생활 소품](screenshots/tablet-1024x768/room-research.png)

### tablet-1024x768 · room-office

교무실 책상과 미션 03 표식. E 안내가 채널 막대와 겹치지 않습니다.

![교무실 업무 공간과 가구](screenshots/tablet-1024x768/room-office.png)

### tablet-1024x768 · room-copier

눈 달린 복사기의 찡그린 얼굴과 옆 책상 서류가 보입니다.

![복사기와 주변 서류·용지](screenshots/tablet-1024x768/room-copier.png)

### tablet-1024x768 · room-exterior

중앙현관 캐노피의 ‘퇴근초등학교 중앙 현관’ 간판과 안쪽 복도가 보입니다.

![학교 외벽·창틀·입구와 주변 풍경](screenshots/tablet-1024x768/room-exterior.png)

### tablet-1024x768 · room-broadcast

방송실 ON AIR 표시, 모니터, 마이크, 삼각대 카메라와 NPC가 보입니다.

![방송실 모니터·카메라·방송 장비](screenshots/tablet-1024x768/room-broadcast.png)

### tablet-1024x768 · room-window

투명한 유리창 너머 아파트 단지와 하늘이 보입니다.

![투명 유리창 너머 한국식 아파트와 실제 바깥 공간](screenshots/tablet-1024x768/room-window.png)

### tablet-1024x768 · window-night

밤 창밖 아파트의 켜진 창과 밝게 유지된 실내가 보입니다.

![밤의 실제 창밖 아파트와 밝게 유지된 실내](screenshots/tablet-1024x768/window-night.png)

### tablet-1024x768 · exterior-night

밤 중앙현관과 어두워진 앞마당, 켜진 실내가 보입니다.

![밤의 아파트·운동장·달·가로등](screenshots/tablet-1024x768/exterior-night.png)

### tablet-1024x768 · characters-front

여섯 캐릭터 정면: 눈과 앞머리가 가리지 않고 이름표가 읽힙니다.

![여섯 실제 3D 캐릭터 정면: 눈과 앞머리 확인](screenshots/tablet-1024x768/characters-front.png)

### tablet-1024x768 · characters-quarter

여섯 캐릭터 45°: 귀·목·옆머리가 이어져 보입니다.

![여섯 실제 3D 캐릭터 45°: 얼굴·귀·목·옆머리 확인](screenshots/tablet-1024x768/characters-quarter.png)

### tablet-1024x768 · yard-gate

1층 앞마당 동쪽의 초록 아치 ‘운동장 가는 길 →’과 바닥 화살표, 벤치·울타리가 보입니다. 왼쪽에 명예의 전당 동상 받침이 일부 걸리지만 아치와 플레이어는 가리지 않습니다.

![1층 앞마당 동쪽의 ‘운동장 가는 길’ 아치와 화살표](screenshots/tablet-1024x768/yard-gate.png)

### tablet-1024x768 · yard-arrival

운동장 도착 장면. E 안내(‘중앙현관 · 학교 안으로 돌아가기’)를 하단 버튼 줄과 채널 막대 위로 올려 서로 겹치지 않습니다.

![중앙현관 밖 운동장 도착: 마사토·트랙·골대·구령대·스탠드](screenshots/tablet-1024x768/yard-arrival.png)

### tablet-1024x768 · yard-school-side

운동장에서 본 학교 외벽과 ‘중앙현관 · 학교 안으로’ 간판, 쪽지가 매달린 느티나무와 벤치, ‘오늘도 무사히 퇴근’ 구령대와 배움·퇴근초·쉼 깃발이 보입니다.

![운동장에서 본 학교 외벽·중앙현관·수돗가·느티나무](screenshots/tablet-1024x768/yard-school-side.png)

### tablet-1024x768 · yard-night

밤 운동장의 달·별, 조명탑 아래 바닥 빛, 꼬마전구와 가로등. E 안내가 채널 막대 위에 따로 보입니다.

![밤 운동장: 조명탑·달·별, 느티나무 꼬마전구](screenshots/tablet-1024x768/yard-night.png)

### tablet-1024x768 · faucet

수돗가와 간판, 수도꼭지. E 안내가 하단 버튼·채널 막대와 겹치지 않습니다.

![수돗가 스테인리스 수도꼭지와 시멘트 개수대](screenshots/tablet-1024x768/faucet.png)

### tablet-1024x768 · faucet-panel

오늘의 퀴즈: 날짜·문제 번호, 주제 표시, 문제와 세 보기가 겹침 없이 보입니다. 주제 표시가 정답 보기를 드러내지 않습니다.

![오늘의 퀴즈 문제와 세 가지 보기](screenshots/tablet-1024x768/faucet-panel.png)

### tablet-1024x768 · farm

학교 쪽을 향한 생태 밭 팻말과 울타리, 이름표가 보이고 E 안내가 하단 막대 위에 있습니다.

![생태 밭 입구·나무 울타리·팻말과 커피나무들](screenshots/tablet-1024x768/farm.png)

### tablet-1024x768 · farm-panel

내 커피나무 카드(이름표·5단계 표시·물 주기 상태), 가방 속 믹스커피, 이름표 검색과 기기 저장 안내가 보입니다.

![내 커피나무 성장 단계와 나무 찾기](screenshots/tablet-1024x768/farm-panel.png)

### tablet-1024x768 · zelkova

느티나무 간판이 머리 위에 보이고 E 안내가 하단 막대 위에 있습니다.

![느티나무·벤치와 매달린 쪽지](screenshots/tablet-1024x768/zelkova.png)

### tablet-1024x768 · zelkova-panel

민트색 쪽지 한 장, 작성자 표시(‘선생님’ 한 번만), 🙋 🤗 🏃 반응 버튼과 내 쪽지 지우기, 안내가 보입니다.

![쪽지 읽기·반응 버튼](screenshots/tablet-1024x768/zelkova-panel.png)

### tablet-1024x768 · ending

“선생님도, 하교합니다.” 엔딩 문구와 해 질 녘 학교 전경·주차장이 보이고 글자가 잘리지 않습니다.

![실제 퇴근 엔딩 장면](screenshots/tablet-1024x768/ending.png)

### tablet-1024x768 · certificate

증명서 제목이 화면 안에 있고 닉네임·퇴근 시각·야근 시간이 크게 보입니다.

![퇴근 증명서의 닉네임·퇴근 시각·야근 시간](screenshots/tablet-1024x768/certificate.png)

### tablet-1024x768 · certificate-export

내려받은 증명서 PNG에 닉네임·퇴근 시각·야근 시간·노하우 10가지가 들어 있습니다.

![실제 저장 버튼으로 내려받은 퇴근 증명서 PNG](screenshots/tablet-1024x768/certificate-export.png)

### tablet-1024x768 · certificate-choices

학교에 남아 놀기·보건실에서 쉬기, 실제 플레이 시간과 노하우 10/10이 보입니다.

![증명서 저장·학교에 남기·보건실에서 쉬기 선택](screenshots/tablet-1024x768/certificate-choices.png)

### tablet-1024x768 · after-certificate-hub

퇴근 후 1층으로 돌아와 10/10 결재와 자유시간 시계가 보입니다.

![퇴근 기록을 유지한 채 학교에 돌아온 캐릭터와 자유시간 HUD](screenshots/tablet-1024x768/after-certificate-hub.png)

### tablet-1024x768 · after-certificate-rest

퇴근 후 보건실에 다시 누워 학교 시계가 ¼ 속도로 흐릅니다.

![퇴근 후 다시 누운 보건실과 천천히 흐르는 시계](screenshots/tablet-1024x768/after-certificate-rest.png)

### tablet-1024x768 · certificate-revisited

자유시간 뒤 다시 연 증명서에 처음 퇴근 시각과 야근 시간이 그대로입니다.

![자유시간 뒤 다시 연 증명서: 처음 퇴근 시각과 야근 시간 유지](screenshots/tablet-1024x768/certificate-revisited.png)
