# THE SQUARE STUDIO

가산 프리미엄 실내 체육관(배드민턴 · 요가 · 코트 대관) 웹사이트. 정적 HTML, GitHub Pages로 호스팅합니다.

- 페이지: `index`(홈: 하늘 사진 + 소개) / `badminton`(대관 → 레슨) / `yoga`(레슨 → 대관) / `contact` / `about` · `rental.html`은 예전 주소용 이동 페이지
- 공통 스타일·스크립트: `assets/style.css`, `assets/main.js`
- 시간표 데이터: `assets/schedule.js` (요가 · 배드민턴)
- 대관 예약: `assets/booking.js` + `assets/booking-config.js` (배드민턴·요가 페이지 `#rental`). 배드민턴은 코트를 여러 면(최대 `maxCourts` 3면) 같이 고르고, 고른 시간이 그 코트 모두에 담긴다. 시간은 시작 칸 → 끝 칸을 누르면 그 사이가 한 번에 담기고(요가 10분 쉬는 시간도 이어진 칸), 범위 가운데를 누르면 시작~그 칸으로 줄고 첫 칸을 누르면 범위가 지워지며, 범위 밖을 누르면 그 날 고른 코트 선택이 지워지고 새 시작점이 됨(다른 날짜 · 고르지 않은 코트는 그대로). 코트를 추가해 '코트 1만' 으로 보이는 칸을 누르면 그 범위에 나머지 코트도 담기고, 담아 둔 뒤 시간이 지나거나 예약돼 막힌 칸은 범위에서 빠져 누르면 그 칸만 빠짐. 예약 내역도 이어진 시간을 한 줄(`13:00~15:00 (2시간)`)로 묶어 보여줌 — 신청은 그대로 1코트 1시간 칸 단위로 관리프로그램 `/api/site`에 보냄
- 요가 시간표 이미지: `timetable/yoga-poster.html` → `images/yoga-timetable.png`
