/* ============================================================
   대관 예약 설정
   - api: 대관 신청을 받는 주소. 지금은 THE SQUARE 관리프로그램(thesquare-admin)의 /api/site
          (관리자 > 대관 화면으로 바로 들어감). 비워두면 "문자로 예약 신청" 방식으로 동작합니다.
   - phone: 공간별 대관 문의 번호(문자 접수 · 오류 안내에 사용).
   - courts: 표의 열 이름(왼쪽부터 코트 index 0, 1, 2 …). 신청할 때는 이름이 아니라 index 로 보냅니다.
   - title: 시간표 카드 머리 영문 제목. note: 표 위 짧은 안내.
   - slots: 요일별(0=일 … 6=토) 예약 가능한 시간 칸. "시작-종료" 형식.
            booking/Code.gs 의 SPACES 와 똑같이 맞춰야 합니다.
   ============================================================ */
(function () {
  const p = n => String(n).padStart(2, '0');
  const HOURLY = Array.from({ length: 24 }, (_, h) => `${p(h)}:00-${p(h + 1)}:00`);
  // 요가실 대관 시간 (운영 계획표 기준): 평일 13:30–17:20, 금요일 저녁 17:30–21:20
  const YOGA_DAY = ['13:30-14:20', '14:30-15:20', '15:30-16:20', '16:30-17:20'];
  const YOGA_FRI_EVE = ['17:30-18:20', '18:30-19:20', '19:30-20:20', '20:30-21:20'];

  window.BOOKING = {
    api: 'https://thesquare-admin-production.up.railway.app/api/site',
    days: 62,                 // 오늘부터 약 2달(62일) 뒤까지 예약 가능 (Code.gs BOOKING_DAYS · 관리프로그램 RENTAL_DAYS 와 동일)
    maxItems: 72,             // 한 번에 신청할 수 있는 최대 칸 수 = 코트 수 × 시간 (Code.gs MAX_ITEMS · 관리프로그램 RENTAL_MAX_ITEMS 와 동일)
    maxCourts: 3,             // 한 신청에서 같이 고를 수 있는 코트 수 (최소 1). 공간 코트 수보다 크면 그 수까지 — 홈페이지 화면 제한만, 관리프로그램은 코트 수만 검사
    wholeLabel: '전체대관',   // 코트를 모두 고른 신청의 표시 이름
    spaces: {
      badminton: {
        name: '배드민턴센터', phone: '010-7576-1861', unit: '1코트 1시간', price: 52800,
        courts: ['COURT 1', 'COURT 2', 'COURT 3'], title: 'COURT RESERVATION',
        note: '코트별로 대관 가능하며, 여러 코트는 같은 시간으로 함께 신청할 수 있어요 · 다른 시간은 코트별로 따로 신청해주세요',
        slots: [HOURLY, HOURLY, HOURLY, HOURLY, HOURLY, HOURLY, HOURLY],
      },
      yoga: {
        name: '요가센터', phone: '010-7569-1861', unit: '공간 전체 1시간', price: 100000,
        courts: ['요가센터'], title: 'STUDIO RESERVATION',
        note: '평일 13:30–17:20 · 금요일 17:30–21:20 (요가 수업 시간 제외) · 시작·끝 시간을 누르면 그 사이가 한 번에 선택돼요',
        slots: [[], YOGA_DAY, YOGA_DAY, YOGA_DAY, YOGA_DAY, YOGA_DAY.concat(YOGA_FRI_EVE), []],
      },
    },
  };
})();
