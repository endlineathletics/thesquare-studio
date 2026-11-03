/* ============================================================
   시간표 데이터 — 여기만 수정하면 수강신청서(badminton-apply.html 03 반·타임·코치 카드)가 같이 바뀝니다.
   cells 순서: 월, 화, 수, 목
   - ['수업명', '코치', 'BD_CATS 키'] : 수업
   - 'R'                 : 대관 (세로로 연속되면 자동 병합)
   - null                : 비어있음
   - { band: '...' }     : 그 시간대 전체를 한 줄로 표시
   (표로 그리려면 페이지에 data-timetable="badminton" 구역 — assets/main.js initTimetable)
   ============================================================ */

/* 배드민턴 — cells 순서: 월, 화, 수, 목 · 세 번째 값은 색상 분류(BD_CATS 키) */
window.BD_CATS = {
  am_mw: { label: '성인 오전반 · 월·수', c: '#0058FC', bg: '#e6eeff', price: '월 25만원' },
  am_tt: { label: '성인 오전반 · 화·목', c: '#1a9fd6', bg: '#e0f3fb', price: '월 25만원' },
  // 유소년반 = 요일 하나 (2026-11 — 주 1회 · 월 4회 · 월 15만원, 두 요일이면 요일반 2개를 따로 신청). 관리프로그램 classes.site_key 와 같은 키
  jr_mo: { label: '유소년반 · 월요일',   c: '#12a38a', bg: '#e2f6f2', price: '월 15만원' },
  jr_tu: { label: '유소년반 · 화요일',   c: '#6f9a12', bg: '#f0f9dc', price: '월 15만원' },
  jr_we: { label: '유소년반 · 수요일',   c: '#0e8a9b', bg: '#e0f4f6', price: '월 15만원' },
  jr_th: { label: '유소년반 · 목요일',   c: '#9a8a12', bg: '#f7f3d9', price: '월 15만원' },
  pm_mw: { label: '성인 저녁반 · 월·수', c: '#06101f', bg: '#e6e9f1', price: '월 35만원' },
  pm_tt: { label: '성인 저녁반 · 화·목', c: '#7a5ce0', bg: '#efebff', price: '월 35만원' },
};
window.bdCat = function (name) { return name.includes('유소년') ? 'jr_mo' : name.includes('저녁') ? 'pm_mw' : 'am_mw'; };

(function () {
  const AM_MW = ['성인 오전반', '김민지 · 김현규', 'am_mw'], AM_TT = ['성인 오전반', '이동찬 · 이동혁', 'am_tt'];
  const JR = [['유소년반', '김민지', 'jr_mo'], ['유소년반', '이동찬', 'jr_tu'], ['유소년반', '김민지', 'jr_we'], ['유소년반', '이동찬', 'jr_th']];
  const PM_MW = ['성인 저녁반', '김동욱 · 김민지', 'pm_mw'], PM_TT = ['성인 저녁반', '김동욱 · 이동찬', 'pm_tt'];
  const row = (time, end, mw, tt) => ({ time, end, cells: [mw, tt, mw, tt] });
  const jrRow = (time, end) => ({ time, end, cells: JR });      // 유소년 = 요일마다 다른 반 (월·화·수·목 요일반)
  window.BD_SCHEDULE = [
    { section: 'MORNING · 성인 오전반' },
    row('10:00', '11:00', AM_MW, AM_TT),
    row('11:00', '12:00', AM_MW, AM_TT),
    row('12:00', '13:00', AM_MW, AM_TT),
    { section: 'AFTERNOON · 유소년반' },
    jrRow('15:00', '16:00'),
    jrRow('16:00', '17:00'),
    jrRow('17:00', '18:00'),
    { section: 'EVENING · 성인 저녁반' },
    row('18:30', '19:30', PM_MW, PM_TT),
    row('19:30', '20:30', PM_MW, PM_TT),
    row('20:30', '21:30', PM_MW, PM_TT),
    row('21:30', '22:30', PM_MW, PM_TT),
  ];
})();
