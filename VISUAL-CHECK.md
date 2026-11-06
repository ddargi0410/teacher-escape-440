# 학교 환경·캐릭터 보완 — 실제 화면 확인

실제 Chromium 153.0.8010.0 · webgl · SwiftShader · 1366×820 / 1024×768 · 90장면 · 콘솔/페이지 오류 0 · 단위 테스트 352개 통과

촬영: 2026-11-06T12:20:05.342Z ~ 2026-11-06T12:30:09.754Z (UTC)

## 요청 사항 체크리스트

| 항목 | 반영 결과 |
| --- | --- |
| 1 · 공간 비율 | 복도 폭 3m, 천장 높이 3m, 교실 8×9m를 실제 충돌·천장 면으로 검증했습니다. 1~5층 천장과 형광등을 유지합니다. |
| 2 · 질감 | 미세한 점의 미장 벽, 아래 1m 옅은 연두색 판, 테라조, 나무 마루, 흡음 천장 질감을 적용했습니다. 보건실에도 같은 재질을 연결했습니다. |
| 3 · 빛 | 창가 사각 햇빛, 자발광 형광등, 부드러운 그림자, ACES 톤매핑·sRGB를 사용합니다. 야간에는 실외가 어두워지고 햇빛이 꺼집니다. |
| 4 · 창밖 | 일반 창문의 산·마을 그림과 이미지 파일을 제거했습니다. 실제 투명 유리 너머 운동장·도로·한국식 아파트 7동이 보이며 밤에는 아파트 창 불빛이 켜집니다. 보건실 호수는 유지합니다. |
| 5 · 소품 | 연구실에 수학·과학·만들기 교구장 두 개를 넣었습니다. 방송실에는 송출·멀티뷰 모니터, 장비 랙, 삼각대 카메라, 마이크·헤드폰을 배치했습니다. 기존 믹스커피·간식·의자 4개·먹다 남은 종이컵 2개를 유지합니다. |
| 6 · 표정 있는 물건 | 복사기는 용지 걸림 연출에 찡그리고 알림 스피커는 새 쪽지에 놀랍니다. 입 모양을 곡선과 동그란 입으로 보완했습니다. |
| 7 · 성능 | 실행 중 사용하는 텍스처는 모두 1024px 이하입니다. 유일한 외부 풍경 이미지는 48,504바이트의 호수 WebP이며, 아파트·재질은 공유 캔버스로 생성합니다. 낮음에서 그림자·햇빛이 실제로 꺼지는지 브라우저로 검사했습니다. 5층은 450개 메시·31,944삼각형으로 기존 상한을 지켰습니다. |
| 8 · 게임 보존 | 미션·채점·진행·저장·메신저·방문 기록은 변경하지 않았습니다. 모든 층의 시작 위치·충돌 영역·상호작용 대상과 좌표를 원본과 비교했습니다. 카메라에 붙은 경비와 장비의 가림 수정은 그리는 순간에만 적용됩니다. |
| 9 · 보고 | 요청 항목별 결과와 두 해상도 90장면의 직접 관찰을 아래에 기록했습니다. |
| 10 · 캐릭터 | 6종의 짧고 열린 앞머리, 눈·볼터치·목 연결과 선택 카드를 다듬었습니다. 머리만 따로 이동시키던 눕기를 연결된 몸의 기울기로 바꿨습니다. 6종×침대 5개×자세 2개의 연결을 기하 검사하고 정면·측면·바로/옆/반대쪽/베개 시점을 실제 화면으로 확인했습니다. |

## 장면별 직접 확인

각 PNG를 직접 열어 장면 구성, 캐릭터·건물 가림, 글자·버튼 겹침과 한국어 줄바꿈을 확인했습니다. 테스트는 HTTP localhost에서 실행했고 공개 방문 기록을 만들지 않았습니다. 실제 학교 PC의 FPS를 측정한 결과는 아닙니다.

### laptop-1366x820 · 01-home

층별 색 띠와 파란 현관 지붕이 보이는 학교 전경, 큰 시작 문구와 버튼이 분리되어 있다. 한국어 잘림이나 겹침은 보이지 않는다.

![시작 화면과 학교 전경](screenshots/laptop-1366x820/01-home.png)

### laptop-1366x820 · 02-check-in

닉네임 입력칸과 여섯 캐릭터 카드가 보이고 선택 표시가 명확하다. 카드의 얼굴·이름이 겹치지 않으며 아래 시작 버튼은 패널을 내려서 접근한다.

![닉네임 입력과 여섯 캐릭터 선택](screenshots/laptop-1366x820/02-check-in.png)

### laptop-1366x820 · 03-first-floor

천장 패널·연두 벽판·유리창이 이어지는 복도에 분홍 옷 플레이어가 보인다. 지나가는 학생과 구분되며 현관 지붕이 플레이어를 가리지 않는다.

![1층 허브의 플레이어와 가까운 3인칭 시점](screenshots/laptop-1366x820/03-first-floor.png)

### laptop-1366x820 · 04-walk

2초 이동 뒤 플레이어의 머리부터 신발까지 보이며 창밖 운동장과 아파트가 유지된다. HUD와 하단 버튼 글자는 겹치지 않는다.

![W로 2초 이동한 뒤의 건물·플레이어·HUD](screenshots/laptop-1366x820/04-walk.png)

### laptop-1366x820 · 05-overview

내려다보기에서 천장이 걷히고 급식실·중앙계단·복도의 캐릭터가 보인다. 플레이어가 건물에 묻히지 않고 시점 버튼도 읽힌다.

![내려다보기 전환 뒤 학교 구조와 플레이어](screenshots/laptop-1366x820/05-overview.png)

### laptop-1366x820 · 06-first-person

눈높이에서 중앙계단·비상구 표지·소화기·복도 원근이 보인다. 가까운 학생은 화면 아래쪽에 있지만 중앙 시야와 조작 안내는 읽힌다.

![1인칭 전환 뒤 복도와 HUD](screenshots/laptop-1366x820/06-first-person.png)

### laptop-1366x820 · 07-low-quality

낮음 설정에서도 복도 재질과 캐릭터·창밖 아파트가 보인다. 그림자와 사각 햇빛은 꺼지고 글자·버튼 겹침은 없다.

![실제 설정 메뉴에서 저 품질로 바꾼 복도](screenshots/laptop-1366x820/07-low-quality.png)

### laptop-1366x820 · mission-01-briefing

OX 조작 3단계와 완료 조건, 시작 버튼이 한 화면에 모두 보입니다. 글자 겹침이나 한국어 단어 중간 끊김은 보이지 않습니다.

![미션 1 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-01-briefing.png)

### laptop-1366x820 · mission-01-play

OX 바닥 구역과 중앙 플레이어, 문제 문장·타이머가 뚜렷합니다. 건물에 가려지지 않고 하단 이동 안내와 버튼도 분리되어 있습니다.

![미션 1 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-01-play.png)

### laptop-1366x820 · mission-02-briefing

머그컵으로 카드 5장을 받는 방법과 역할→대상→목표→조건→출력 순서가 읽힙니다. 안내와 시작 버튼 사이 여백이 충분합니다.

![미션 2 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-02-briefing.png)

### laptop-1366x820 · mission-02-play

상단 역할 완료 표시가 한 곳에 있고 대상 학년 단계와 머그컵 1/5가 보입니다. 촬영 순간 낙하 카드는 없지만 게임 영역·컵·조작 화살표는 정상 표시됩니다.

![미션 2 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-02-play.png)

### laptop-1366x820 · mission-03-briefing

전화 받기와 구체적인 요청 선택 방법, 완료 조건이 잘 보입니다. 긴 예시 문장도 버튼을 가리지 않습니다.

![미션 3 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-03-briefing.png)

### laptop-1366x820 · mission-03-play

전화기 6대와 부재중 안내·횟수·시간이 서로 떨어져 보입니다. 번호와 하단 안내가 읽히며 빈 화면은 아닙니다.

![미션 3 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-03-play.png)

### laptop-1366x820 · mission-04-briefing

책 줍기·꽂기·함정 반납 조작과 책 7권 조건이 표시됩니다. 본문과 버튼에 겹침이나 어색한 단어 줄바꿈은 없습니다.

![미션 4 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-04-briefing.png)

### laptop-1366x820 · mission-04-play

책장·반납함과 8개 책 이름, E 버튼이 읽힙니다. 기존 미니게임의 책 이름표가 중앙 캐릭터 머리 일부를 가리는 모습은 남아 있어 기록하며 이번 환경 수정에서는 미니게임을 변경하지 않았습니다.

![미션 4 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-04-play.png)

### laptop-1366x820 · mission-05-briefing

오류 신고서의 4칸과 드래그 대체 조작 안내가 한 화면에 들어옵니다. 시작·나가기 버튼은 모두 잘 보입니다.

![미션 5 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-05-briefing.png)

### laptop-1366x820 · mission-05-play

번호가 붙은 모니터 6대와 0/3 진행도·타이머·하단 조작 안내가 보입니다. 촬영 순간 벌레는 숨어 있으며 글자나 버튼 겹침은 보이지 않습니다.

![미션 5 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-05-play.png)

### laptop-1366x820 · mission-06-briefing

과학실 미션의 세 단계 안내와 완료 조건, 시작 버튼이 한 화면에 읽힙니다. 한국어 단어 중간 줄바꿈이나 버튼 가림은 보이지 않습니다.

![미션 6 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-06-briefing.png)

### laptop-1366x820 · mission-06-play

문장 카드와 좋은 습관 바구니가 간격을 두고 보이며, 피드백은 상단 한 곳에 표시됩니다. 제목·시간·판정 문구가 서로 겹치지 않습니다.

![미션 6 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-06-play.png)

### laptop-1366x820 · mission-07-briefing

정보 분류 방법과 좌·하·우 방향 안내, 완료 조건이 분리되어 읽힙니다. 하단 두 버튼이 설명을 가리지 않습니다.

![미션 7 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-07-briefing.png)

### laptop-1366x820 · mission-07-play

검색대와 컨베이어 위 가상 이름 카드, 통과·가상 예시·압수 버튼 세 개가 모두 보입니다. 카드 글자와 하단 안내가 겹치지 않습니다.

![미션 7 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-07-play.png)

### laptop-1366x820 · mission-08-briefing

방송 화면 수정의 입력 확인·부분 수정·저장 순서가 한 화면에 들어옵니다. 시작 버튼과 설명 글자에 잘림이 없습니다.

![미션 8 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-08-briefing.png)

### laptop-1366x820 · mission-08-play

미션의 의도된 NO SIGNAL 미리보기와 입력 소스 확인 버튼이 크게 표시됩니다. 시간·상태 안내·버튼 글자가 분리되어 읽힙니다.

![미션 8 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-08-play.png)

### laptop-1366x820 · mission-09-briefing

반찬 카드와 세 칸 식판의 조작법, 완료 조건이 읽힙니다. HTML·CSS·JavaScript 설명과 시작 버튼에 겹침이 없습니다.

![미션 9 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-09-briefing.png)

### laptop-1366x820 · mission-09-play

버튼 색 반찬 카드, HTML·CSS·JS 식판과 하단 선택 버튼이 모두 보입니다. 피드백은 상단 한 줄이며 버튼을 가리지 않습니다.

![미션 9 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-09-play.png)

### laptop-1366x820 · mission-10-briefing

프롬프트 작성 방법과 방패 완료 조건이 한 화면에 표시됩니다. 긴 한국어 안내도 단어 단위로 읽히고 버튼은 온전히 보입니다.

![미션 10 설명·완료 조건·시작 버튼](screenshots/laptop-1366x820/mission-10-briefing.png)

### laptop-1366x820 · mission-10-play

왼쪽 보스 장면과 오른쪽 입력창·힌트·여섯 조건 카드가 구분되어 보입니다. 입력 예시가 잘리지 않고 조건 카드 글자와 버튼도 겹치지 않습니다.

![미션 10 실제 플레이 3초 뒤](screenshots/laptop-1366x820/mission-10-play.png)

### laptop-1366x820 · rest-back

베개에 머리를 대고 바로 누운 캐릭터의 눈·미소와 어깨까지 이어진 목이 보인다. 옆 침대·화분·창밖 호수가 함께 보이며, 아래 휴식 버튼과 안내 문구는 겹치지 않는다.

![보건실 바로 눕기·침대·화분·호수](screenshots/laptop-1366x820/rest-back.png)

### laptop-1366x820 · rest-reverse

침대 반대편으로 돌아보면 뒤통수와 어깨가 이어진 채 이불 위로 몸이 보이고, 화분·출입문·교실 복도가 배경에 들어온다. 머리만 떨어져 보이는 틈이나 버튼 가림은 보이지 않는다.

![누운 채 반대쪽으로 돌아본 머리·목·어깨 연결](screenshots/laptop-1366x820/rest-reverse.png)

### laptop-1366x820 · rest-eyes

베개 눈높이에서는 흡음 천장과 형광등, 보건실 출입문이 보이며 자신의 머리나 앞머리가 시야를 덮지 않는다. 하단의 자세·음악·일어나기 버튼과 한국어 안내가 읽힌다.

![베개 눈높이에서 본 보건실 천장·창문·옆 침대](screenshots/laptop-1366x820/rest-eyes.png)

### laptop-1366x820 · rest-side

옆으로 누운 얼굴의 눈·볼터치·미소가 머리카락에 가려지지 않고, 목과 어깨가 이어진 채 베개 위에 놓인다. 옆으로 눕기 선택 표시와 음악·일어나기 버튼이 서로 겹치지 않는다.

![보건실 옆으로 눕기·침대·화분·호수](screenshots/laptop-1366x820/rest-side.png)

### laptop-1366x820 · room-classroom

나무 마루와 색깔별 학생 의자, 칠판, 흡음 천장과 형광등 패널이 보인다. 플레이어 전신이 책상 사이에 드러나며 하단 살펴보기 버튼과 조작 안내의 글자는 겹치거나 단어 중간에서 끊기지 않는다.

![교실 칠판·교탁·사물함·창문](screenshots/laptop-1366x820/room-classroom.png)

### laptop-1366x820 · room-research

중앙 협의 테이블의 믹스커피·간식·종이컵 두 개와 사무용 의자, 뒤편 두 교구장의 지구본·수 모형·책·색종이·연필통을 확인했다. 교구장과 테이블이 통로를 구분하고 HUD와 상호작용 버튼의 글자도 읽힌다.

![학년 연구실 책상과 생활 소품](screenshots/laptop-1366x820/room-research.png)

### laptop-1366x820 · room-office

양쪽 책상 위 모니터와 서류 더미, 뒤편 수납장, 테라조 바닥과 연두 벽판이 보인다. 문틀이 화면 오른쪽에 있어도 플레이어 전신은 가려지지 않으며 상호작용 버튼과 한국어 안내가 겹치지 않는다.

![교무실 업무 공간과 가구](screenshots/laptop-1366x820/room-office.png)

### laptop-1366x820 · room-copier

복사기의 눈과 치켜든 눈썹, 아래로 처진 입이 선명해 용지 걸림 표정이 읽힌다. 조작부·서랍 손잡이와 주변 책상·서류가 함께 보이고 얼굴이나 버튼을 가리는 토스트는 없다.

![복사기와 주변 서류·용지](screenshots/laptop-1366x820/room-copier.png)

### laptop-1366x820 · room-exterior

중앙현관 앞 캐릭터의 머리·몸·발이 모두 보이고, 파란 현관 지붕과 노란 1층 외벽이 뒤에 있다. 지붕이 캐릭터를 가리지 않으며 HUD는 읽힌다.

![학교 외벽·창틀·입구와 주변 풍경](screenshots/laptop-1366x820/room-exterior.png)

### laptop-1366x820 · room-broadcast

왼쪽 믹서·마이크·헤드폰, 뒤쪽 방송 모니터 두 개와 장비 랙, 오른쪽 삼각대 카메라가 한 화면에 들어온다. ON AIR 표지는 다른 현수막과 겹치지 않으며 NPC 얼굴과 하단 버튼 글자도 가려지지 않는다.

![방송실 모니터·카메라·방송 장비](screenshots/laptop-1366x820/room-broadcast.png)

### laptop-1366x820 · room-window

투명한 창틀 너머 여러 동의 입체 아파트와 외부 지면·도로가 보인다. 창문에 붙은 산·마을 사진은 없고 건물의 옆면과 간격이 구분된다.

![투명 유리창 너머 한국식 아파트와 실제 바깥 공간](screenshots/laptop-1366x820/room-window.png)

### laptop-1366x820 · window-night

17:40에 바깥 아파트는 어두워지고 일부 창에 노란색·흰색 불빛이 켜진다. 실내 벽은 밝고, 수정 후 경비의 머리·팔·손전등이 카메라를 막지 않는다.

![밤의 실제 창밖 아파트와 밝게 유지된 실내](screenshots/laptop-1366x820/window-night.png)

### laptop-1366x820 · exterior-night

17:40 현관과 운동장이 어두워지고 바닥의 가로등 빛 웅덩이가 보인다. 캐릭터 실루엣과 현관 안내·HUD는 식별되며 화면을 가리는 구조물은 없다.

![밤의 아파트·운동장·달·가로등](screenshots/laptop-1366x820/exterior-night.png)

### laptop-1366x820 · characters-front

여섯 실제 3D 캐릭터의 정면에서 두 눈·미소·볼터치가 보이며, 앞머리는 눈썹 위에서 끝난다. 둥근 안경·네모 안경 안쪽의 눈도 가려지지 않고 파스텔 의상과 짧은 팔다리가 구분된다.

![여섯 실제 3D 캐릭터 정면: 눈과 앞머리 확인](screenshots/laptop-1366x820/characters-front.png)

### laptop-1366x820 · characters-quarter

비스듬한 각도에서도 눈과 안경이 앞머리·옆머리에 가려지지 않는다. 단발 옆머리, 올림머리, 곱슬머리의 다른 실루엣과 머리 아래 목·옷깃 연결이 보인다.

![여섯 실제 3D 캐릭터 45°: 얼굴·귀·목·옆머리 확인](screenshots/laptop-1366x820/characters-quarter.png)

### laptop-1366x820 · ending

노을빛 학교 앞에서 차가 출발하고 ‘선생님도, 하교합니다.’ 문구가 중앙에 보인다. 엔딩 글씨가 배경과 분리되어 읽힌다.

![실제 퇴근 엔딩 장면](screenshots/laptop-1366x820/ending.png)

### laptop-1366x820 · certificate

퇴근 증명서 제목과 닉네임, 16:42 퇴근·야근 2분이 크게 보인다. 제목이 화면 밖으로 밀리거나 시간 숫자가 겹치지 않는다.

![퇴근 증명서의 닉네임·퇴근 시각·야근 시간](screenshots/laptop-1366x820/certificate.png)

### laptop-1366x820 · certificate-export

실제 저장한 PNG에 퇴근 시각·야근 시간·노하우 10개가 모두 담겼다. 승인 표시와 한국어 문장에 잘림이나 카드 경계 넘침이 없다.

![실제 저장 버튼으로 내려받은 퇴근 증명서 PNG](screenshots/laptop-1366x820/certificate-export.png)

### tablet-1024x768 · 01-home

층별 색 띠와 파란 현관 지붕이 있는 학교 전경이 큰 제목 옆에 보인다. 1024px에서도 시작 버튼과 안내 문구가 잘리지 않는다.

![시작 화면과 학교 전경](screenshots/tablet-1024x768/01-home.png)

### tablet-1024x768 · 02-check-in

닉네임 입력칸과 6종 캐릭터 카드가 3열로 보이고 선택 표시가 분명하다. 시작 버튼은 이 스크롤 패널의 아래쪽에 있으며 카드 글자는 겹치지 않는다.

![닉네임 입력과 여섯 캐릭터 선택](screenshots/tablet-1024x768/02-check-in.png)

### tablet-1024x768 · 03-first-floor

연두색 하부 벽판, 노란 기둥, 천장 패널과 형광등이 보인다. 가까운 학생이 플레이어 하반신 일부를 지나가지만 지붕이나 벽이 플레이어를 가리지는 않는다.

![1층 허브의 플레이어와 가까운 3인칭 시점](screenshots/tablet-1024x768/03-first-floor.png)

### tablet-1024x768 · 04-walk

걷고 난 뒤 플레이어의 머리부터 발까지 보이며 복도 깊이와 천장 조명이 이어진다. 하단 조작 버튼의 글자 가림은 없다.

![W로 2초 이동한 뒤의 건물·플레이어·HUD](screenshots/tablet-1024x768/04-walk.png)

### tablet-1024x768 · 05-overview

내려다보기에서 천장이 걷혀 계단과 교실, 플레이어를 볼 수 있다. 시점 변경 안내가 잠시 상단 진행 표시 위에 뜨지만 조작 버튼을 덮지는 않는다.

![내려다보기 전환 뒤 학교 구조와 플레이어](screenshots/tablet-1024x768/05-overview.png)

### tablet-1024x768 · 06-first-person

눈높이에서 비상구 표지와 복도 끝, 계단과 창문이 이어져 보인다. 가까운 학생이 화면 아래 모서리를 지나가지만 중앙 시야와 버튼은 읽을 수 있다.

![1인칭 전환 뒤 복도와 HUD](screenshots/tablet-1024x768/06-first-person.png)

### tablet-1024x768 · 07-low-quality

그림자와 햇빛 효과가 꺼진 상태에서도 테라조·벽판·목재 질감은 유지된다. 플레이어 전신과 하단 조작 안내가 보이며 단어 중간 줄바꿈은 보이지 않는다.

![실제 설정 메뉴에서 저 품질로 바꾼 복도](screenshots/tablet-1024x768/07-low-quality.png)

### tablet-1024x768 · mission-01-briefing

태블릿에서도 OX 설명·완료 조건과 두 버튼이 화면 안에 모두 보입니다. 글자가 겹치거나 단어 중간에서 끊기지 않습니다.

![미션 1 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-01-briefing.png)

### tablet-1024x768 · mission-01-play

OX 구역과 중앙 플레이어, 타이머·문제 문장이 선명하게 표시됩니다. 방향 버튼과 하단 조작 안내도 화면 안에 있습니다.

![미션 1 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-01-play.png)

### tablet-1024x768 · mission-02-briefing

머그컵 조작 3단계와 5칸 완성 조건이 한 화면에 들어옵니다. 한국어 문장과 시작 버튼이 겹치지 않습니다.

![미션 2 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-02-briefing.png)

### tablet-1024x768 · mission-02-play

낙하 카드 3장과 머그컵, 현재 필요한 역할 안내가 읽힙니다. 기존 낙하 연출 중 카드가 단계 표시줄 일부를 지나가지만 위쪽의 현재 단계·안내와 하단 조작 화살표는 보입니다.

![미션 2 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-02-play.png)

### tablet-1024x768 · mission-03-briefing

전화 받기와 요청 선택 안내가 충분한 여백으로 배치되어 있습니다. 긴 예시와 완료 조건, 시작 버튼이 모두 읽힙니다.

![미션 3 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-03-briefing.png)

### tablet-1024x768 · mission-03-play

전화기 6대와 부재중 안내, 진행도·시간이 화면에 들어옵니다. 버튼 가림이나 한국어 단어 중간 줄바꿈은 보이지 않습니다.

![미션 3 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-03-play.png)

### tablet-1024x768 · mission-04-briefing

책 이동·줍기·반납 방법과 완료 조건이 한 화면에 표시됩니다. 시작 버튼과 본문 간격이 유지됩니다.

![미션 4 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-04-briefing.png)

### tablet-1024x768 · mission-04-play

책장·반납함·책 이름과 E 버튼이 읽힙니다. 노트북과 마찬가지로 기존 책 이름표가 중앙 캐릭터 머리 일부를 가리며, 미니게임 변경 금지 범위에 따라 그대로 기록합니다.

![미션 4 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-04-play.png)

### tablet-1024x768 · mission-05-briefing

증상·기대·오류 메시지·범위 설명과 드래그 대체 조작이 잘 보입니다. 버튼이나 글자가 화면 밖으로 나가지 않습니다.

![미션 5 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-05-briefing.png)

### tablet-1024x768 · mission-05-play

모니터 6대와 숫자 조작 안내, 0/3 진행도·87초 표시가 보입니다. 촬영 순간 벌레는 숨어 있지만 화면은 비어 있지 않고 글자 겹침도 없습니다.

![미션 5 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-05-play.png)

### tablet-1024x768 · mission-06-briefing

태블릿에서도 과학실 안내 세 단계와 완료 조건, 시작 버튼이 모두 들어옵니다. 문장이나 버튼 글자에 잘림·겹침이 없습니다.

![미션 6 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-06-briefing.png)

### tablet-1024x768 · mission-06-play

문장 카드와 바구니 사이 여백이 남고 카드 문장이 한 줄로 읽힙니다. 상단 피드백은 한 번 표시되며 시간·제목과 겹치지 않습니다.

![미션 6 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-06-play.png)

### tablet-1024x768 · mission-07-briefing

통과·가상 예시·압수의 분류 안내와 세 단계 설명이 온전히 보입니다. 한국어 단어 중간 줄바꿈이나 버튼 가림은 없습니다.

![미션 7 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-07-briefing.png)

### tablet-1024x768 · mission-07-play

가상 이름 카드가 검색대 앞에 보이고 하단 세 선택 버튼이 화면 안에 맞습니다. 안내·진행 수치·타이머가 각각 분리되어 읽힙니다.

![미션 7 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-07-play.png)

### tablet-1024x768 · mission-08-briefing

입력 소스 확인부터 저장까지의 절차와 완료 조건이 한 화면에 들어옵니다. 두 하단 버튼의 글자를 가리는 요소는 없습니다.

![미션 8 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-08-briefing.png)

### tablet-1024x768 · mission-08-play

의도된 NO SIGNAL 화면과 입력 소스 확인 버튼이 태블릿 폭에 맞춰 줄어듭니다. 상태 안내와 버튼 글자가 선명하며 겹침이 없습니다.

![미션 8 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-08-play.png)

### tablet-1024x768 · mission-09-briefing

반찬 카드 조작과 세 칸 식판 설명이 모두 보입니다. 용어 설명과 시작 버튼이 잘리지 않고 한국어가 자연스럽게 이어집니다.

![미션 9 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-09-briefing.png)

### tablet-1024x768 · mission-09-play

반찬 카드, 넓은 세 칸 식판, 하단 선택 버튼이 함께 보입니다. 상단 피드백은 한 곳에 표시되고 식판 글자나 버튼을 가리지 않습니다.

![미션 9 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-09-play.png)

### tablet-1024x768 · mission-10-briefing

먹이사슬 프롬프트 작성법과 방패 완료 조건이 화면 안에 들어옵니다. 긴 안내에도 단어 중간 줄바꿈과 버튼 겹침이 보이지 않습니다.

![미션 10 설명·완료 조건·시작 버튼](screenshots/tablet-1024x768/mission-10-briefing.png)

### tablet-1024x768 · mission-10-play

보스 장면 옆 입력창의 두 예시 문단과 여섯 조건 카드가 모두 보입니다. 태블릿에서도 예시 마지막 문장과 카드 글자가 잘리지 않습니다.

![미션 10 실제 플레이 3초 뒤](screenshots/tablet-1024x768/mission-10-play.png)

### tablet-1024x768 · rest-back

태블릿에서도 누운 캐릭터의 눈·미소, 목에서 어깨로 이어지는 부분과 베개가 보인다. 호수 창문과 주변 침대가 함께 들어오고 하단 버튼·휴식 안내는 단어 중간 끊김 없이 표시된다.

![보건실 바로 눕기·침대·화분·호수](screenshots/tablet-1024x768/rest-back.png)

### tablet-1024x768 · rest-reverse

180도 반대편에서 뒤통수·옆머리와 어깨가 연결된 모습, 침대 머리판과 보건실 출입문이 보인다. 캐릭터가 벽에 가려지지 않으며 하단 안내와 버튼도 겹치지 않는다.

![누운 채 반대쪽으로 돌아본 머리·목·어깨 연결](screenshots/tablet-1024x768/rest-reverse.png)

### tablet-1024x768 · rest-eyes

내 눈으로 보기에서는 천장 텍스와 형광등, 출입문 너머 복도가 보이고 자신의 머리가 화면을 가리지 않는다. 옆에서 보기로 돌아가는 버튼과 일어나기 버튼 모두 화면 안에 온전히 들어온다.

![베개 눈높이에서 본 보건실 천장·창문·옆 침대](screenshots/tablet-1024x768/rest-eyes.png)

### tablet-1024x768 · rest-side

옆으로 누운 머리와 몸통이 이어져 있고 얼굴을 덮는 앞머리나 이불을 뚫고 나온 신발이 보이지 않는다. 자세 선택·음악·일어나기 버튼은 좁은 화면에서도 서로 구분되어 읽힌다.

![보건실 옆으로 눕기·침대·화분·호수](screenshots/tablet-1024x768/rest-side.png)

### tablet-1024x768 · room-classroom

좁은 화면에서도 책상 사이 플레이어 전신, 색깔 의자, 칠판과 형광등이 보인다. 살펴보기 버튼과 이동 안내는 읽히며 말풍선의 한국어도 단어 중간에서 끊기지 않는다.

![교실 칠판·교탁·사물함·창문](screenshots/tablet-1024x768/room-classroom.png)

### tablet-1024x768 · room-research

테이블의 커피 상자·간식·종이컵 두 개와 뒤쪽 교구장이 보이며 오른쪽 교구장의 바깥쪽은 화면 가장자리에서 자연스럽게 잘린다. 채널 패널이 살펴보기 버튼 우하단 외곽에 살짝 닿지만 버튼 문구는 가리지 않는다.

![학년 연구실 책상과 생활 소품](screenshots/tablet-1024x768/room-research.png)

### tablet-1024x768 · room-office

책상 두 개의 모니터·서류와 가운데 플레이어 전신을 확인했고 문틀에 몸이 가려지지 않는다. 채널 패널과 살펴보기 버튼의 우하단 배경이 조금 겹치지만 버튼 글자는 모두 읽힌다.

![교무실 업무 공간과 가구](screenshots/tablet-1024x768/room-office.png)

### tablet-1024x768 · room-copier

복사기가 정상 상태의 미소와 초록 표시등으로 보이며 노트북 장면의 찡그림과 구별된다. 얼굴·조작부·서랍이 온전히 보이고 하단 버튼이나 한국어 안내를 가리는 요소는 없다.

![복사기와 주변 서류·용지](screenshots/tablet-1024x768/room-copier.png)

### tablet-1024x768 · room-exterior

중앙현관 앞에서 캐릭터의 머리·목·몸·발이 이어져 보이고 현관 지붕에 가려지지 않는다. 파란 지붕과 1층 노란 외벽 띠가 유지된다.

![학교 외벽·창틀·입구와 주변 풍경](screenshots/tablet-1024x768/room-exterior.png)

### tablet-1024x768 · room-broadcast

방송 모니터 두 개, 믹서·마이크·헤드폰, 스피커와 삼각대 카메라가 태블릿 화각 안에 함께 보인다. NPC의 눈·얼굴과 ON AIR 표지가 또렷하며 UI 문구의 겹침이나 단어 중간 줄바꿈은 보이지 않는다.

![방송실 모니터·카메라·방송 장비](screenshots/tablet-1024x768/room-broadcast.png)

### tablet-1024x768 · room-window

흰 창틀과 투명 유리 너머로 3D 아파트, 땅과 도로가 보인다. 산·마을 사진은 없고 실내 안내와 창밖 풍경이 분리되어 읽힌다.

![투명 유리창 너머 한국식 아파트와 실제 바깥 공간](screenshots/tablet-1024x768/room-window.png)

### tablet-1024x768 · window-night

17:40의 어두운 아파트에 일부 창 불빛과 별이 보이며 실내 벽은 밝게 남는다. 경비나 장비가 렌즈를 덮지 않고 창밖 전체가 보인다.

![밤의 실제 창밖 아파트와 밝게 유지된 실내](screenshots/tablet-1024x768/window-night.png)

### tablet-1024x768 · exterior-night

야간 운동장과 건물이 어두워지고 바닥에 조명 영역이 보인다. 캐릭터 전신의 윤곽과 밝은 HUD는 식별되며 건물에 가리지는 않는다.

![밤의 아파트·운동장·달·가로등](screenshots/tablet-1024x768/exterior-night.png)

### tablet-1024x768 · characters-front

태블릿의 3×2 배열에서도 여섯 얼굴의 눈·눈썹·미소가 분명히 보이고 앞머리가 눈을 덮지 않는다. 안경 두 종류와 단발·올림머리·곱슬머리, 각 의상의 색을 구분할 수 있다.

![여섯 실제 3D 캐릭터 정면: 눈과 앞머리 확인](screenshots/tablet-1024x768/characters-front.png)

### tablet-1024x768 · characters-quarter

비스듬한 여섯 얼굴에서 눈·안경과 옆머리의 경계가 구분되고 머리와 목·옷깃도 이어져 보인다. 모델 전체가 각 칸 안에 들어오며 설명의 한국어 단어가 중간에서 끊기지 않는다.

![여섯 실제 3D 캐릭터 45°: 얼굴·귀·목·옆머리 확인](screenshots/tablet-1024x768/characters-quarter.png)

### tablet-1024x768 · ending

노을빛 학교와 교문 밖으로 나가는 자동차가 보이고 중앙 퇴근 문구가 읽힌다. 1024px에서도 제목 잘림이나 다른 글자와의 겹침은 없다.

![실제 퇴근 엔딩 장면](screenshots/tablet-1024x768/ending.png)

### tablet-1024x768 · certificate

닉네임과 퇴근 시각 16:42, 야근 2분이 크게 표시된다. 증명서는 스크롤 영역 안에 있고 시간·제목·본문 사이가 분리되어 있다.

![퇴근 증명서의 닉네임·퇴근 시각·야근 시간](screenshots/tablet-1024x768/certificate.png)

### tablet-1024x768 · certificate-export

저장한 긴 증명서 이미지에 닉네임, 퇴근·야근 시간과 노하우 카드 10개가 모두 들어간다. 글자가 카드 밖으로 넘치거나 단어 중간에서 끊기는 모습은 보이지 않는다.

![실제 저장 버튼으로 내려받은 퇴근 증명서 PNG](screenshots/tablet-1024x768/certificate-export.png)
