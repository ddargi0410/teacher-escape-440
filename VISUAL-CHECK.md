# 퇴근 후 자유시간 · 보건실 느린 시계 — 실제 화면 확인

실제 Chromium 153.0.8010.0 · SwiftShader webgl · 1366×820 / 1024×768 · 98장면 · 콘솔/페이지/빈 화면 오류 0 · 단위 테스트 366개 통과

실행: 2026-11-08T08:09:44.319Z ~ 2026-11-08T08:27:02.058Z (UTC)

## 반영 내용

- 퇴근 증명서에서 학교에 남아 놀기 또는 보건실에서 쉬기를 선택합니다. 학교에 복귀하면 10개 완료 기록을 유지한 채 이동·상호작용·채널을 다시 이용합니다.
- 보건실에 누워 있는 동안 학교 시계는 평소의 ¼ 속도로 흐릅니다. 실제 2분이 게임 1분이며, 실제 플레이 시간과 휴식 초시계는 정상 속도로 셉니다. 보건실 하단에 학교 시각과 ¼ 속도를 표시합니다.
- 노하우 가방과 일시정지 메뉴에서 증명서를 다시 볼 수 있습니다. 최초 완료 시각·야근 시간·완료까지 실제 플레이 시간은 자유시간이나 저장·재접속 뒤에도 고정됩니다.
- 일시정지 메뉴와 숨긴 탭에서는 시간이 흐르지 않습니다. 자동으로 빈 채널을 찾을 때 휴식을 취소하지 않으며 수동 채널 이동은 기존 동작을 유지합니다.
- 미션 문제·정답·채점과 학교 환경은 변경하지 않았습니다. 이전 저장 파일을 계속 사용할 수 있습니다.

## 확인 방법

HTTP localhost에서 실제 Chromium을 실행했습니다. 각 PNG를 직접 열어 플레이어·건물 가림, 글자·버튼 겹침과 한국어 줄바꿈을 확인했습니다. 테스트로 실제 방문·명예의 전당 기록을 만들지 않았습니다. 실제 학교 PC의 FPS 측정 결과는 아닙니다.

## 장면별 관찰

### laptop-1366x820 · 01-home

층별 색 띠를 두른 학교 외관과 시작 버튼, 하단 방문 통계가 보입니다. 제목과 버튼이 겹치거나 한국어 단어가 잘린 부분은 보이지 않습니다.

![시작 화면과 학교 전경](screenshots/laptop-1366x820/01-home.png)

### laptop-1366x820 · 02-check-in

입력한 닉네임과 여섯 캐릭터 선택 카드가 표시되고 선택 테두리도 분명합니다. 아래 출근 버튼은 패널을 스크롤해 누르는 구조이며, 보이는 카드의 글자는 겹치지 않습니다.

![닉네임 입력과 여섯 캐릭터 선택](screenshots/laptop-1366x820/02-check-in.png)

### laptop-1366x820 · 03-first-floor

1층 복도에서 분홍 옷 플레이어와 작은 학생, 창밖 아파트가 보입니다. 플레이어는 지붕이나 천장에 가리지 않고, 상단 시계·안내·하단 조작 버튼이 각각 읽힙니다.

![1층 허브의 플레이어와 가까운 3인칭 시점](screenshots/laptop-1366x820/03-first-floor.png)

### laptop-1366x820 · 04-walk

W 이동 뒤 캐릭터 전신과 이어지는 복도, 계단 표지가 보입니다. 가까이 지나가는 학생은 하단 UI 뒤로 그려져 버튼 글자를 가리지 않으며 한국어 안내도 정상 줄바꿈됩니다.

![W로 2초 이동한 뒤의 건물·플레이어·HUD](screenshots/laptop-1366x820/04-walk.png)

### laptop-1366x820 · 05-overview

내려다보기에서 1층 급식실·중앙계단·명예의 전당 동상과 플레이어가 함께 보입니다. 천장과 현관 지붕이 플레이어를 덮지 않으며 조작 안내와 버튼은 분리되어 있습니다.

![내려다보기 전환 뒤 학교 구조와 플레이어](screenshots/laptop-1366x820/05-overview.png)

### laptop-1366x820 · 06-first-person

1인칭 눈높이에서 비상구 표시, 중앙계단과 복도 학생이 보이고 자기 캐릭터는 시야에서 빠집니다. 천장 안쪽으로 카메라가 들어가지 않으며 HUD·버튼 글자도 읽힙니다.

![1인칭 전환 뒤 복도와 HUD](screenshots/laptop-1366x820/06-first-person.png)

### laptop-1366x820 · 07-low-quality

낮음 설정에서도 플레이어와 창문·마루·천장 질감이 남아 있고 복도 화면이 비지 않습니다. 그림자와 햇빛 효과가 빠진 상태로 캐릭터 전신과 버튼이 잘 보입니다.

![실제 설정 메뉴에서 저 품질로 바꾼 복도](screenshots/laptop-1366x820/07-low-quality.png)

### laptop-1366x820 · mission-01-briefing

OX 이동 방법 세 단계와 완료 조건이 한 화면에 보인다. 시작·학교로 나가기 버튼의 글자가 겹치거나 한국어가 단어 중간에서 끊기지 않는다.

![미션 1 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-01-briefing.png)

### laptop-1366x820 · mission-01-play

교실 바닥의 O·X 구역과 중앙 플레이어, 움직이는 학생들이 분명하게 보인다. 문제 문장·타이머·방향 버튼이 서로 겹치지 않고 플레이어도 건물에 가리지 않는다.

![미션 1 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-01-play.png)

### laptop-1366x820 · mission-02-briefing

학년 연구실의 카드 받기 목표와 세 단계 안내가 읽힌다. 완료 조건과 두 버튼이 분리되어 있고 한글 줄바꿈이나 글자 겹침은 보이지 않는다.

![미션 2 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-02-briefing.png)

### laptop-1366x820 · mission-02-play

커피잔과 세 장의 낙하 카드가 보이며 카드 글자는 읽힌다. 낙하 카드가 중앙 단계 표시줄 일부를 지나가지만 왼쪽 위 현재 ‘역할’ 안내와 하단 조작 영역은 보인다.

![미션 2 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-02-play.png)

### laptop-1366x820 · mission-03-briefing

교무실 전화 받기와 구체적인 요청 고르기의 설명이 보인다. 문장·완료 조건·시작 버튼이 분리되어 있으며 단어 중간 줄바꿈은 보이지 않는다.

![미션 3 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-03-briefing.png)

### laptop-1366x820 · mission-03-play

책상 위 전화기 여섯 대와 부재중 안내, 진행 수와 제한 시간이 보인다. 전화기 번호·버튼과 상단 안내가 겹치지 않고 화면이 비어 있지 않다.

![미션 3 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-03-play.png)

### laptop-1366x820 · mission-04-briefing

도서관의 책 줍기·꽂기와 함정 책 반납 방법이 보인다. 번호가 붙은 설명과 하단 완료 조건·시작 버튼을 모두 읽을 수 있다.

![미션 4 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-04-briefing.png)

### laptop-1366x820 · mission-04-play

책장과 반납함, 바닥 책 이름표와 이동·상호작용 버튼이 보인다. 기존처럼 ‘뼈대만 만들기’ 이름표가 플레이어의 머리 일부를 가리지만 이름표 글자와 조작 버튼은 읽힌다.

![미션 4 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-04-play.png)

### laptop-1366x820 · mission-05-briefing

벌레를 잡아 오류 신고서 네 칸을 채우는 방법이 보인다. 설명 줄과 완료 조건, 하단 버튼에 글자 겹침이나 잘림은 없다.

![미션 5 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-05-briefing.png)

### laptop-1366x820 · mission-05-play

모니터 여섯 대 중 네 번째 화면에 주황색 벌레가 나타나 있다. 남은 시간·진행 수·숫자키 안내가 분리되어 읽히며 캔버스는 정상적으로 그려져 있다.

![미션 5 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-05-play.png)

### laptop-1366x820 · mission-06-briefing

과학실 미션의 문장 분류 방법과 완료 조건이 한 카드에 보이고 시작·나가기 버튼이 아래에 분리돼 있다. 문구 겹침이나 한국어 단어 중간 잘림은 보이지 않는다.

![미션 6 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-06-briefing.png)

### laptop-1366x820 · mission-06-play

오답 설명은 상단 한 곳에 있고, 중앙 문장 방울과 아래 좋은 습관 버튼이 분리되어 보인다. 타이머·진행 수치와 버튼 글자가 가려지지 않는다.

![미션 6 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-06-play.png)

### laptop-1366x820 · mission-07-briefing

행정실 개인정보 분류의 세 방향과 가상 예시 안내가 읽힌다. 단계·완료 조건·시작 버튼 사이 간격이 충분하다.

![미션 7 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-07-briefing.png)

### laptop-1366x820 · mission-07-play

컨베이어 위 가상 이름 카드와 통과·가상 예시·압수 버튼 세 개가 보인다. 안내나 카드가 버튼 글자를 덮지 않는다.

![미션 7 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-07-play.png)

### laptop-1366x820 · mission-08-briefing

방송실 화면 수정 순서와 저장 조건이 한 화면에 들어간다. 긴 설명도 단어 단위로 읽히고 하단 버튼이 잘리지 않는다.

![미션 8 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-08-briefing.png)

### laptop-1366x820 · mission-08-play

송출 화면의 NO SIGNAL은 미션 시작 상태로 표시되고 아래 입력 소스 확인 버튼이 보인다. 상단 안내·타이머와 게임 화면이 겹치지 않는다.

![미션 8 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-08-play.png)

### laptop-1366x820 · mission-09-briefing

HTML·CSS·JS 반찬 분류와 마지막 20초 규칙이 보인다. 시작 버튼과 완료 조건이 잘리지 않고 분리되어 있다.

![미션 9 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-09-briefing.png)

### laptop-1366x820 · mission-09-play

버튼 색 반찬 카드, 큰 3칸 식판과 하단 선택 버튼이 모두 보인다. 상단 피드백은 한 곳에 표시되며 버튼 글자를 가리지 않는다.

![미션 9 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-09-play.png)

### laptop-1366x820 · mission-10-briefing

최종 프롬프트의 대상·형식·조건 안내와 방패 완료 기준이 보인다. 한국어 단어 잘림이나 시작 버튼 가림은 보이지 않는다.

![미션 10 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-10-briefing.png)

### laptop-1366x820 · mission-10-play

왼쪽 교문·NPC·방패와 오른쪽 프롬프트 입력칸·힌트·여섯 조건 카드가 분리되어 보인다. 입력 예시와 조건 문구가 잘리지 않고 읽힌다.

![미션 10 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-10-play.png)

### laptop-1366x820 · rest-back

침대에 누운 캐릭터의 얼굴·목 연결과 옆 침대, 화분, 호수 창문이 보인다. 휴식 패널에 학교 시계 16:00·¼ 속도와 실제 휴식 시간이 나란히 표시되고 버튼이나 글자가 겹치지 않는다.

![보건실 바로 눕기·침대·화분·호수](screenshots/laptop-1366x820/rest-back.png)

### laptop-1366x820 · rest-reverse

누운 캐릭터를 반대쪽에서 돌아보면 뒷머리와 베개, 침대 옆 식물·출입구가 보인다. 학교 시계·휴식 타이머·시선 버튼은 화면 아래에 분리되어 읽히고 단어 중간 잘림은 보이지 않는다.

![누운 채 반대쪽으로 돌아본 머리·목·어깨 연결](screenshots/laptop-1366x820/rest-reverse.png)

### laptop-1366x820 · rest-eyes

베개 눈높이에서 흡음 천장·형광등·보건실 출입구와 수납장이 보이며 자기 머리가 시야를 덮지 않는다. 아래 패널의 학교 시계와 ‘옆에서 보기’ 버튼이 또렷하게 표시된다.

![베개 눈높이에서 본 보건실 천장·창문·옆 침대](screenshots/laptop-1366x820/rest-eyes.png)

### laptop-1366x820 · rest-side

옆으로 누운 얼굴과 상체가 베개·이불 위에 연결되어 보이고 주변 침대와 호수 창문도 보인다. 자세 선택 표시와 학교 시계 ¼ 속도 안내가 겹치지 않는다.

![보건실 옆으로 눕기·침대·화분·호수](screenshots/laptop-1366x820/rest-side.png)

### laptop-1366x820 · room-classroom

나무 마루와 색색의 의자, 칠판·천장 형광등이 보이고 플레이어 전신이 드러난다. 하단 살펴보기 버튼과 채널 표시가 분리되어 있으며 한국어 글자 잘림은 보이지 않는다.

![교실 칠판·교탁·사물함·창문](screenshots/laptop-1366x820/room-classroom.png)

### laptop-1366x820 · room-research

협의 테이블에 믹스커피·간식·종이컵 두 개, 주변 의자 네 개와 교구장이 보인다. 1인칭 시야와 하단 살펴보기 버튼이 확보되고 글자·버튼 겹침이나 단어 중간 줄바꿈은 보이지 않는다.

![학년 연구실 책상과 생활 소품](screenshots/laptop-1366x820/room-research.png)

### laptop-1366x820 · room-office

교무실 책상 두 개의 모니터·서류 더미와 플레이어 전신이 보인다. 문 위 3D 간판은 화면 상단에서 일부 잘리지만 조작 안내와 살펴보기 버튼의 글자는 가려지지 않는다.

![교무실 업무 공간과 가구](screenshots/laptop-1366x820/room-office.png)

### laptop-1366x820 · room-copier

1인칭으로 눈·눈썹과 웃는 입이 달린 복사기, 옆 모니터·서류 더미와 테라조 바닥이 보인다. 화면 아래 조작 안내·채널 패널이 분리되어 글자를 가리지 않는다.

![복사기와 주변 서류·용지](screenshots/laptop-1366x820/room-copier.png)

### laptop-1366x820 · room-exterior

중앙현관 간판과 파란 지붕 앞에서 캐릭터 전신이 보입니다. 지붕이 캐릭터를 가리지 않고, 배경의 큰 간판과 화면 위 HUD는 별개로 읽힙니다.

![학교 외벽·창틀·입구와 주변 풍경](screenshots/laptop-1366x820/room-exterior.png)

### laptop-1366x820 · room-broadcast

방송 모니터 두 개, 믹서·마이크·헤드폰, 스피커와 삼각대 카메라가 보이고 중앙 교사의 전신도 드러난다. 1인칭 화면의 상하단 안내 글자와 버튼은 서로 겹치지 않는다.

![방송실 모니터·카메라·방송 장비](screenshots/laptop-1366x820/room-broadcast.png)

### laptop-1366x820 · room-window

3층 투명 유리창 너머 실제 아파트 여러 동과 도로가 보입니다. 1인칭 화면이 빈색으로 바뀌지 않고, 상하단 안내·버튼에도 겹침이 없습니다.

![투명 유리창 너머 한국식 아파트와 실제 바깥 공간](screenshots/laptop-1366x820/room-window.png)

### laptop-1366x820 · window-night

17:40의 창밖은 어두워지고 아파트 창문에 불이 켜진 반면 실내 창틀은 보입니다. 야근 시계와 조작 버튼이 선명하며 글자 줄바꿈 문제는 보이지 않습니다.

![밤의 실제 창밖 아파트와 밝게 유지된 실내](screenshots/laptop-1366x820/window-night.png)

### laptop-1366x820 · exterior-night

밤의 현관은 어둡고 바닥의 조명 영역과 밝은 간판이 보이며 캐릭터 전신 윤곽도 남아 있습니다. 캐릭터는 낮보다 어둡게 보이지만 지붕에 가려지지 않고 화면 시계·버튼은 읽힙니다.

![밤의 아파트·운동장·달·가로등](screenshots/laptop-1366x820/exterior-night.png)

### laptop-1366x820 · characters-front

여섯 캐릭터의 앞머리가 눈을 가리지 않고 얼굴·목·몸통이 이어져 보인다. 이름은 발 바로 아래에 가깝게 놓였지만 읽을 수 있고 한국어 단어 중간 잘림은 없다.

![여섯 실제 3D 캐릭터 정면: 눈과 앞머리 확인](screenshots/laptop-1366x820/characters-front.png)

### laptop-1366x820 · characters-quarter

45도 시점에서도 여섯 캐릭터의 눈·귀·목이 드러나며 머리와 몸통 사이가 떨어져 보이지 않는다. 카드 이름과 설명은 각각 한 줄로 읽힌다.

![여섯 실제 3D 캐릭터 45°: 얼굴·귀·목·옆머리 확인](screenshots/laptop-1366x820/characters-quarter.png)

### laptop-1366x820 · ending

노을빛 학교 외관·교문·동상·주차장이 보이고 가운데 ‘선생님도, 하교합니다.’가 한 줄로 나온다. 화면은 빈 캔버스가 아니며 엔딩 문구가 다른 UI와 겹치지 않는다.

![실제 퇴근 엔딩 장면](screenshots/laptop-1366x820/ending.png)

### laptop-1366x820 · certificate

퇴근 증명서에 닉네임·퇴근 시각 16:42·야근 2분이 크게 읽히고 ‘학교에 남아 놀기’, ‘보건실에서 쉬기’가 첫 화면 안에 보인다. 기록이 바뀌지 않는다는 안내가 버튼 아래에 따로 놓여 겹치지 않는다.

![퇴근 증명서의 닉네임·퇴근 시각·야근 시간](screenshots/laptop-1366x820/certificate.png)

### laptop-1366x820 · certificate-export

저장된 증명서 이미지에 닉네임·퇴근 시각 16:42·야근 2분·실제 플레이 18분 30초가 일치한다. 노하우 10개와 하단 안내까지 전체 이미지 안에 들어가며 카드끼리 겹치지 않는다.

![실제 저장 버튼으로 내려받은 퇴근 증명서 PNG](screenshots/laptop-1366x820/certificate-export.png)

### laptop-1366x820 · certificate-choices

스크롤한 증명서에서 두 복귀 버튼·기록 확정 안내·실제 플레이 18:30·완료 10/10이 함께 보인다. 제목과 아래 저장 버튼 일부는 패널 스크롤 경계 밖에 있지만 두 선택 버튼의 글자는 온전히 보인다.

![증명서 저장·학교에 남기·보건실에서 쉬기 선택](screenshots/laptop-1366x820/certificate-choices.png)

### laptop-1366x820 · after-certificate-hub

1층 복도로 돌아와 10/10 완료 상태와 ‘퇴근 완료·자유시간’, 16:42 시계가 표시된다. 플레이어 앞을 지나가는 학생이 몸 일부와 겹치지만 지붕·건물에 가려지지는 않고 보건실·조작 버튼 글자는 읽힌다.

![퇴근 기록을 유지한 채 학교에 돌아온 캐릭터와 자유시간 HUD](screenshots/laptop-1366x820/after-certificate-hub.png)

### laptop-1366x820 · after-certificate-rest

퇴근 뒤 다시 침대에 누운 캐릭터와 베개·이불·옆 침대·호수 창문이 보이며 목이 떨어져 보이지 않는다. 학교 시계 16:42·¼ 속도와 휴식 타이머 00:04가 따로 표시되고 일어나기·자세 버튼을 가리지 않는다.

![퇴근 후 다시 누운 보건실과 천천히 흐르는 시계](screenshots/laptop-1366x820/after-certificate-rest.png)

### laptop-1366x820 · certificate-revisited

학교에서 움직이고 보건실에서 쉰 뒤 재열기한 증명서도 퇴근 16:42·야근 2분을 유지한다. 복귀 버튼 두 개와 기록 확정 안내가 처음과 같은 위치에 읽히며 글자 겹침은 없다.

![자유시간 뒤 다시 연 증명서: 처음 퇴근 시각과 야근 시간 유지](screenshots/laptop-1366x820/certificate-revisited.png)

### tablet-1024x768 · 01-home

태블릿 폭에 맞춰 학교 외관·시작 문구·버튼이 배치되고 하단 통계도 화면 안에 들어옵니다. 제목이나 한국어 단어가 중간에서 잘리지 않고 시작 버튼을 가리는 요소도 없습니다.

![시작 화면과 학교 전경](screenshots/tablet-1024x768/01-home.png)

### tablet-1024x768 · 02-check-in

닉네임 입력란과 선택한 캐릭터 카드가 분명하게 보입니다. 두 번째 카드 줄 아래는 스크롤 영역에 이어지며, 보이는 제목·카드 이름·닫기 버튼은 겹치지 않습니다.

![닉네임 입력과 여섯 캐릭터 선택](screenshots/tablet-1024x768/02-check-in.png)

### tablet-1024x768 · 03-first-floor

태블릿의 1층 복도에 플레이어와 가까운 학생, 창밖 현관이 보입니다. 학생이 몸 앞 일부를 지나가지만 지붕·천장이 캐릭터를 덮지 않으며 조작 버튼 글자는 읽힙니다.

![1층 허브의 플레이어와 가까운 3인칭 시점](screenshots/tablet-1024x768/03-first-floor.png)

### tablet-1024x768 · 04-walk

걷기 뒤 분홍 옷 캐릭터와 중앙계단이 보이고 노란 기둥이 캐릭터 오른쪽 머리 가장자리와 살짝 겹칩니다. 전신을 식별할 수 있고 하단 버튼이나 한국어 안내를 가리는 요소는 없습니다.

![W로 2초 이동한 뒤의 건물·플레이어·HUD](screenshots/tablet-1024x768/04-walk.png)

### tablet-1024x768 · 05-overview

내려다보기에서는 중앙의 플레이어, 급식실·계단·동상이 함께 보입니다. 천장과 지붕에 캐릭터가 숨지 않고, 하단 시점 버튼과 도움말도 화면 안에 놓입니다.

![내려다보기 전환 뒤 학교 구조와 플레이어](screenshots/tablet-1024x768/05-overview.png)

### tablet-1024x768 · 06-first-person

태블릿 1인칭에서 비상구와 학생, 복도 끝 공간이 보입니다. 자기 캐릭터 머리가 시야를 막지 않으며 상단 시계·하단 버튼과 한국어 안내가 겹치지 않습니다.

![1인칭 전환 뒤 복도와 HUD](screenshots/tablet-1024x768/06-first-person.png)

### tablet-1024x768 · 07-low-quality

낮음 설정에서도 복도·캐릭터·창밖 현관이 표시되고 그림자·햇빛 효과는 빠져 있습니다. 노란 기둥과 머리 가장자리의 작은 겹침은 이동 화면과 같으며 UI 글자와 버튼은 가려지지 않습니다.

![실제 설정 메뉴에서 저 품질로 바꾼 복도](screenshots/tablet-1024x768/07-low-quality.png)

### tablet-1024x768 · mission-01-briefing

태블릿에서도 OX 이동 설명 세 단계와 완료 조건이 한 화면에 들어간다. 시작·나가기 버튼 글자가 가려지지 않고 한국어가 단어 중간에서 끊기지 않는다.

![미션 1 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-01-briefing.png)

### tablet-1024x768 · mission-01-play

작은 화면에서도 O·X 바닥과 중앙 플레이어 전신, 학생 두 명이 보인다. 문제·카운트다운·방향 버튼이 읽히며 캐릭터가 건물에 가리지 않는다.

![미션 1 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-01-play.png)

### tablet-1024x768 · mission-02-briefing

카드 다섯 장을 받아 요청의 다섯 칸을 완성하는 설명이 보인다. 안내 문장과 완료 조건이 잘리지 않고 하단 두 버튼도 모두 화면 안에 있다.

![미션 2 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-02-briefing.png)

### tablet-1024x768 · mission-02-play

‘역할 완성’과 1/5 진행 수, 다음 ‘대상 학년’ 단계가 보이는 카드 사이 대기 장면이다. 단계표·커피잔·좌우 조작 영역이 모두 읽히며 이 촬영 장면에서는 겹침이 없다.

![미션 2 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-02-play.png)

### tablet-1024x768 · mission-03-briefing

전화 받기와 구체적인 요청 선택 방법이 태블릿 폭에 맞게 보인다. 긴 예시 문장도 한 줄로 읽히고 시작 버튼과 겹치지 않는다.

![미션 3 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-03-briefing.png)

### tablet-1024x768 · mission-03-play

전화기 여섯 대가 3열로 배치되고 부재중 한 통 안내와 다음 전화 대기 문구가 보인다. 전화기 번호나 상단 버튼을 덮는 글자는 없고 화면 가장자리 잘림도 없다.

![미션 3 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-03-play.png)

### tablet-1024x768 · mission-04-briefing

책을 순서대로 꽂고 함정 책을 반납하는 설명이 한 화면에 보인다. 줄 간격과 시작·학교로 나가기 버튼의 간격이 유지되어 글자가 겹치지 않는다.

![미션 4 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-04-briefing.png)

### tablet-1024x768 · mission-04-play

책장·반납함·책 이름표가 보이며 오른쪽 아래 E 버튼은 읽힌다. 기존과 같이 ‘뼈대만 만들기’ 이름표가 플레이어 머리 일부를 가리지만 몸과 발은 보인다.

![미션 4 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-04-play.png)

### tablet-1024x768 · mission-05-briefing

오류 신고서 작성 단계와 드래그 대신 차례로 누르는 방법이 보인다. 설명·완료 조건·하단 버튼에 잘림이나 단어 중간 줄바꿈은 없다.

![미션 5 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-05-briefing.png)

### tablet-1024x768 · mission-05-play

벌레가 잠시 숨은 상태의 모니터 여섯 대와 ‘숨어도 다시 나와요’ 안내가 보인다. 진행 수·제한 시간·숫자키 안내가 서로 겹치지 않고 버튼 글자도 읽힌다.

![미션 5 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-05-play.png)

### tablet-1024x768 · mission-06-briefing

태블릿에서도 과학실의 세 단계와 완료 조건, 시작·나가기 버튼이 한 카드 안에 보인다. 긴 문구가 단어 중간에서 잘리거나 버튼과 겹치지 않는다.

![미션 6 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-06-briefing.png)

### tablet-1024x768 · mission-06-play

문장 방울과 좋은 습관 버튼이 화면 아래에 분리돼 있고 상단 피드백은 한 줄로 보인다. 좁아진 화면에서도 시간·진행 수치·버튼 글자가 읽힌다.

![미션 6 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-06-play.png)

### tablet-1024x768 · mission-07-briefing

통과·가상 대체·압수의 분류 방법과 개인정보 주의 문구가 보인다. 설명과 하단 버튼 사이에 여백이 있고 글자가 잘리지 않는다.

![미션 7 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-07-briefing.png)

### tablet-1024x768 · mission-07-play

컨베이어의 가상 이름 카드와 세 개의 큰 선택 버튼이 화면 폭에 맞게 배치되어 있다. 카드·안내·버튼이 서로 글자를 가리지 않는다.

![미션 7 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-07-play.png)

### tablet-1024x768 · mission-08-briefing

현장 입력 확인부터 글씨·배경·버튼 수정, 저장까지의 순서가 보인다. 완료 조건과 시작 버튼이 한 화면에 들어가며 한국어 잘림은 없다.

![미션 8 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-08-briefing.png)

### tablet-1024x768 · mission-08-play

미션 시작 상태의 NO SIGNAL 화면과 입력 소스 확인 버튼이 분명하게 보인다. 화면 하단 문구와 조작 버튼이 겹치지 않는다.

![미션 8 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-08-play.png)

### tablet-1024x768 · mission-09-briefing

반찬 카드 내용을 읽어 HTML·CSS·JS에 분류하는 방법이 보인다. 긴 완료 조건과 배우는 내용도 하단 버튼을 가리지 않는다.

![미션 9 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-09-briefing.png)

### tablet-1024x768 · mission-09-play

버튼 색 카드, HTML·CSS·JS 식판과 선택 버튼 세 개가 모두 보인다. 위쪽 피드백은 별도 영역에 있고 버튼 글자를 덮지 않는다.

![미션 9 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-09-play.png)

### tablet-1024x768 · mission-10-briefing

먹이사슬 프롬프트 작성과 방패 다섯 개 완료 조건이 한 화면에 들어간다. 설명·완료 조건·시작 버튼의 글자 겹침은 보이지 않는다.

![미션 10 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-10-briefing.png)

### tablet-1024x768 · mission-10-play

교문 앞 NPC와 방패, 오른쪽 입력칸과 여섯 조건 카드가 태블릿 폭에 맞춰 보인다. 입력 예시 전체를 읽을 수 있고 한국어는 단어 단위로 줄바꿈된다.

![미션 10 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-10-play.png)

### tablet-1024x768 · rest-back

태블릿에서도 누운 캐릭터의 얼굴·목·상체와 옆 침대·식물·호수 창문이 잘 보인다. 아래 패널에 학교 시계 16:00·¼ 속도, 별도 휴식 타이머, 일어나기·자세 버튼이 겹치지 않고 들어간다.

![보건실 바로 눕기·침대·화분·호수](screenshots/tablet-1024x768/rest-back.png)

### tablet-1024x768 · rest-reverse

누운 채 반대 방향을 보면 캐릭터의 뒷머리·베개와 보건실 수납장·출입구가 보인다. 화면 아래 휴식 조작 영역은 글자가 겹치거나 버튼 밖으로 잘리지 않는다.

![누운 채 반대쪽으로 돌아본 머리·목·어깨 연결](screenshots/tablet-1024x768/rest-reverse.png)

### tablet-1024x768 · rest-eyes

내 눈으로 보기에서는 천장 텍스·형광등과 출입구·수납장이 보이고 자기 머리가 시야를 가리지 않는다. 태블릿 폭에서도 ‘옆에서 보기’와 학교 시계·¼ 속도 안내가 선명하게 분리된다.

![베개 눈높이에서 본 보건실 천장·창문·옆 침대](screenshots/tablet-1024x768/rest-eyes.png)

### tablet-1024x768 · rest-side

옆으로 누운 얼굴·목·어깨가 이어져 보이고 베개·보라색 이불·옆 침대와 창밖 호수가 함께 들어온다. 옆으로 눕기 선택 표시와 다른 버튼, 학교 시계 안내는 겹치지 않는다.

![보건실 옆으로 눕기·침대·화분·호수](screenshots/tablet-1024x768/rest-side.png)

### tablet-1024x768 · room-classroom

나무 마루와 네 가지 색 의자·칠판·형광등이 보이며 플레이어 전신이 가려지지 않는다. 채널 패널이 상호작용 카드 우하단을 조금 덮지만 살펴보기 버튼 글자와 한국어 문장은 잘리지 않는다.

![교실 칠판·교탁·사물함·창문](screenshots/tablet-1024x768/room-classroom.png)

### tablet-1024x768 · room-research

1인칭에서 교구장, 믹스커피·간식·두 종이컵과 네 의자를 확인했다. 채널 패널이 살펴보기 버튼 배경의 우하단 약 4px를 덮지만 버튼 글자나 단어는 가리지 않는다.

![학년 연구실 책상과 생활 소품](screenshots/tablet-1024x768/room-research.png)

### tablet-1024x768 · room-office

플레이어 전신과 모니터·서류가 있는 교무실 책상들이 보이고 위쪽 3D 교무실 간판은 일부 잘린다. 채널 패널이 살펴보기 버튼 배경 우하단 약 11px와 겹치지만 글자는 모두 읽힌다.

![교무실 업무 공간과 가구](screenshots/tablet-1024x768/room-office.png)

### tablet-1024x768 · room-copier

1인칭 화면에 눈썹을 찡그리고 입이 아래로 휜 복사기와 옆 서류 더미가 보인다. 하단 조작 안내·채널 패널의 글자가 서로 겹치거나 단어 중간에서 끊기지 않는다.

![복사기와 주변 서류·용지](screenshots/tablet-1024x768/room-copier.png)

### tablet-1024x768 · room-exterior

현관 앞 캐릭터 전신과 중앙계단이 보이고 지붕이 캐릭터를 덮지 않습니다. 큰 현관 간판 일부는 상단 HUD 뒤에 놓이지만 조작 버튼·현재 시각·안내 글자는 가려지지 않습니다.

![학교 외벽·창틀·입구와 주변 풍경](screenshots/tablet-1024x768/room-exterior.png)

### tablet-1024x768 · room-broadcast

방송 모니터·믹서·마이크·헤드폰과 스피커·삼각대 카메라가 화면 안에 보이고 중앙 교사도 전신이 드러난다. 1인칭 안내와 하단 버튼 글자가 가려지거나 단어 중간에서 끊기지 않는다.

![방송실 모니터·카메라·방송 장비](screenshots/tablet-1024x768/room-broadcast.png)

### tablet-1024x768 · room-window

태블릿에서도 창틀 너머 아파트 여러 동과 바닥 그림자가 보입니다. 1인칭 시야가 비지 않고 상단 층 안내와 하단 조작 버튼이 정상 배치됩니다.

![투명 유리창 너머 한국식 아파트와 실제 바깥 공간](screenshots/tablet-1024x768/room-window.png)

### tablet-1024x768 · window-night

17:40에 같은 창밖이 밤으로 바뀌며 아파트 불빛과 별이 보입니다. 실내 창틀과 야근 시계가 구분되고 한국어 안내나 버튼 글자가 겹치지 않습니다.

![밤의 실제 창밖 아파트와 밝게 유지된 실내](screenshots/tablet-1024x768/window-night.png)

### tablet-1024x768 · exterior-night

밤 현관에서는 어두운 캐릭터 전신과 바닥 조명, 뒤쪽 실내가 보입니다. 지붕에 캐릭터가 숨지는 않으며 간판 일부만 HUD 뒤에 놓이고 조작 버튼 글자는 모두 읽힙니다.

![밤의 아파트·운동장·달·가로등](screenshots/tablet-1024x768/exterior-night.png)

### tablet-1024x768 · characters-front

태블릿의 여섯 캐릭터 정면에서 눈을 가리는 앞머리나 머리·몸통 분리는 보이지 않는다. 이름은 신발 바로 아래에 가깝게 놓였지만 여섯 카드 모두 이름과 설명을 읽을 수 있다.

![여섯 실제 3D 캐릭터 정면: 눈과 앞머리 확인](screenshots/tablet-1024x768/characters-front.png)

### tablet-1024x768 · characters-quarter

45도 각도에서 여섯 캐릭터의 얼굴·눈·귀가 드러나고 옆머리가 얼굴 전체를 덮지 않는다. 카드 이름과 설명은 각 카드 안에 한 줄로 들어가며 캐릭터 간 겹침은 없다.

![여섯 실제 3D 캐릭터 45°: 얼굴·귀·목·옆머리 확인](screenshots/tablet-1024x768/characters-quarter.png)

### tablet-1024x768 · ending

태블릿 엔딩에서 노을빛 학교·교문·주차장과 ‘선생님도, 하교합니다.’ 문구가 보인다. 문구는 화면 안에 한 줄로 들어가고 겹치는 HUD는 없다.

![실제 퇴근 엔딩 장면](screenshots/tablet-1024x768/ending.png)

### tablet-1024x768 · certificate

1024×768의 첫 증명서 화면에서 퇴근 시각 16:42·야근 2분과 ‘학교에 남아 놀기’, ‘보건실에서 쉬기’가 모두 보인다. 기록 확정 안내까지 화면 안에 읽히고 버튼 글자나 한국어 단어가 잘리지 않는다.

![퇴근 증명서의 닉네임·퇴근 시각·야근 시간](screenshots/tablet-1024x768/certificate.png)

### tablet-1024x768 · certificate-export

태블릿에서 저장한 증명서도 닉네임·16:42 퇴근·야근 2분·실제 플레이 18분 30초가 읽힌다. 노하우 10장과 하단 안내가 전체 PNG 안에 들어가며 카드 간 겹침은 없다.

![실제 저장 버튼으로 내려받은 퇴근 증명서 PNG](screenshots/tablet-1024x768/certificate-export.png)

### tablet-1024x768 · certificate-choices

스크롤된 증명서의 퇴근 기록 아래에 두 복귀 선택 버튼과 기록 확정 안내가 나란히 보인다. 실제 플레이 18:30·모은 노하우 10/10도 읽히며 제목·저장 버튼 일부는 정상적인 스크롤 영역 밖에 있다.

![증명서 저장·학교에 남기·보건실에서 쉬기 선택](screenshots/tablet-1024x768/certificate-choices.png)

### tablet-1024x768 · after-certificate-hub

태블릿에서도 1층 자유시간 HUD와 완료 10/10·현재 16:42가 유지되고 플레이어가 복도에 보인다. 가까운 학생이 플레이어 몸 일부와 겹치지만 구조물에 가려지지 않으며 하단 보건실·시점·조작 버튼은 분리되어 읽힌다.

![퇴근 기록을 유지한 채 학교에 돌아온 캐릭터와 자유시간 HUD](screenshots/tablet-1024x768/after-certificate-hub.png)

### tablet-1024x768 · after-certificate-rest

퇴근 후 태블릿 화면에서도 침대에 누운 캐릭터의 얼굴·상체와 주변 식물·창밖 호수가 보인다. 학교 시계 16:42·¼ 속도와 휴식 00:03은 별도로 표시되고 일어나기 및 시선 버튼 글자를 가리지 않는다.

![퇴근 후 다시 누운 보건실과 천천히 흐르는 시계](screenshots/tablet-1024x768/after-certificate-rest.png)

### tablet-1024x768 · certificate-revisited

자유시간에 걷고 보건실에서 쉰 뒤 재열기한 증명서도 퇴근 16:42·야근 2분으로 변하지 않는다. 태블릿 폭에서 두 복귀 버튼과 기록 확정 안내가 온전히 읽힌다.

![자유시간 뒤 다시 연 증명서: 처음 퇴근 시각과 야근 시간 유지](screenshots/tablet-1024x768/certificate-revisited.png)
