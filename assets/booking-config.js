/* ============================================================
   대관 예약 설정
   - api: 구글 Apps Script 웹앱 URL (booking/SETUP.md 참고).
          비워두면 "문자로 예약 신청" 방식으로 동작합니다.
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
    api: '',
    phone: '010-7576-1861',
    days: 30,                 // 오늘부터 며칠 뒤까지 예약 가능 (Code.gs BOOKING_DAYS 와 동일)
    maxItems: 72,             // 한 번에 신청할 수 있는 최대 시간 수 (Code.gs MAX_ITEMS 와 동일)
    spaces: {
      badminton: {
        name: '배드민턴센터', unit: '1코트 1시간', price: 52800, courts: ['코트 1', '코트 2', '코트 3'],
        note: '여러 시간 선택 가능 · 24시간 운영',
        slots: [HOURLY, HOURLY, HOURLY, HOURLY, HOURLY, HOURLY, HOURLY],
      },
      yoga: {
        name: '요가센터', unit: '공간 전체 1시간', price: 100000, courts: ['공간 전체'],
        note: '평일 13:30–17:20 · 금요일 17:30–21:20 (요가 수업 시간 제외)',
        slots: [[], YOGA_DAY, YOGA_DAY, YOGA_DAY, YOGA_DAY, YOGA_DAY.concat(YOGA_FRI_EVE), []],
      },
    },
  };
})();
