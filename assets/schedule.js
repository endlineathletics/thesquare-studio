/* ============================================================
   시간표 데이터 — 여기만 수정하면 페이지 표가 같이 바뀝니다.
   cells 순서: 월, 화, 수, 목, 금
   - ['수업명', '강사']  : 수업
   - 'R'                 : 대관 (세로로 연속되면 자동 병합)
   - null                : 비어있음
   - { band: '...' }     : 그 시간대 전체를 한 줄로 표시
   ============================================================ */

window.YOGA_CATS = {
  vinyasa:  { label: '빈야사',      c: '#0058FC', bg: '#e6eeff' },
  hatha:    { label: '하타',        c: '#6f9a12', bg: '#f0f9dc' },
  ashtanga: { label: '아쉬탕가',    c: '#e0752f', bg: '#fff0e6' },
  therapy:  { label: '테라피·교정', c: '#7a5ce0', bg: '#efebff' },
  pilates:  { label: '필라테스',    c: '#12a38a', bg: '#e2f6f2' },
  props:    { label: '소도구',      c: '#c99a0e', bg: '#fdf5d9' },
  hot:      { label: '핫요가',      c: '#e0445a', bg: '#ffe8eb' },
};

window.yogaCat = function (name) {
  if (name.includes('핫요가')) return 'hot';
  if (name.includes('필라테스')) return 'pilates';
  if (name.includes('소도구')) return 'props';
  if (name.includes('아쉬탕가')) return 'ashtanga';
  if (name.includes('빈야사')) return 'vinyasa';
  if (name.includes('하타')) return 'hatha';
  return 'therapy';
};

window.YOGA_SCHEDULE = [
  { section: 'MORNING' },
  { time: '07:30', end: '08:20', cells: [['테라피 요가','이진선'], ['베이직 아쉬탕가','안유림'], ['테라피 요가','이진선'], ['비기너 하타','안유림'], ['빈야사','안유림']] },
  { time: '08:30', end: '09:20', cells: [['베이직 아쉬탕가','이진선'], ['슬로우 빈야사','안유림'], ['테라피 요가','이진선'], ['하타','안유림'], ['교정요가','안유림']] },
  { time: '09:30', end: '10:20', cells: [['소도구 요가','서수옥'], ['소도구 요가','서수옥'], ['소도구 요가','서수옥'], ['소도구 요가','서수옥'], null] },
  { time: '10:30', end: '11:20', cells: [['빈야사','서수옥'], ['하타','서수옥'], ['빈야사','서수옥'], ['테라피 요가','서수옥'], null] },
  { time: '11:30', end: '12:20', cells: [['하타','이은빈'], ['매트 필라테스','김도휘'], ['핫요가','이은빈'], ['매트 필라테스','김도휘'], ['베이직 빈야사','이은빈']] },
  { time: '12:30', end: '13:20', cells: [['매트 필라테스','이은빈'], ['빈야사','김도휘'], ['핫요가','이은빈'], ['빈야사','김도휘'], ['하타','이은빈']] },
  { section: 'AFTERNOON' },
  { time: '13:30', end: '17:20', band: '대관 운영', note: '평일 13:30 – 17:20' },
  { section: 'EVENING' },
  { time: '17:30', end: '18:20', cells: [['빈야사','안유림'], ['골반 테라피','오지운'], ['교정요가','이지영'], ['순환요가','오지운'], 'R'] },
  { time: '18:30', end: '19:20', cells: [['정렬','안유림'], ['빈야사','오지운'], ['아쉬탕가','이지영'], ['하타','오지운'], 'R'] },
  { time: '19:30', end: '20:20', cells: [['하타힐링','이꽃미'], ['교정요가','이지영'], ['빈야사','이꽃미'], ['소도구 필라테스','이지영'], 'R'] },
  { time: '20:30', end: '21:20', cells: [['인양요가','이꽃미'], ['힐링 테라피','이지영'], ['인양요가','이꽃미'], ['빈야사 테라피','이지영'], 'R'] },
];

/* 배드민턴 — cells 순서: 월, 화, 수, 목 · 세 번째 값은 색상 분류(BD_CATS 키) */
window.BD_CATS = {
  am_mw: { label: '성인 오전반 · 월·수', c: '#0058FC', bg: '#e6eeff', price: '월 25만원' },
  am_tt: { label: '성인 오전반 · 화·목', c: '#1a9fd6', bg: '#e0f3fb', price: '월 25만원' },
  jr_mw: { label: '유소년반 · 월·수',    c: '#12a38a', bg: '#e2f6f2', price: '월 15만원' },
  jr_tt: { label: '유소년반 · 화·목',    c: '#6f9a12', bg: '#f0f9dc', price: '월 15만원' },
  pm_mw: { label: '성인 저녁반 · 월·수', c: '#06101f', bg: '#e6e9f1', price: '월 35만원' },
  pm_tt: { label: '성인 저녁반 · 화·목', c: '#7a5ce0', bg: '#efebff', price: '월 35만원' },
};
window.bdCat = function (name) { return name.includes('유소년') ? 'jr_mw' : name.includes('저녁') ? 'pm_mw' : 'am_mw'; };

(function () {
  const AM_MW = ['성인 오전반', '김민지 · 김현규', 'am_mw'], AM_TT = ['성인 오전반', '이동찬 · 이동혁', 'am_tt'];
  const JR_MW = ['유소년반', '김민지', 'jr_mw'],          JR_TT = ['유소년반', '이동찬', 'jr_tt'];
  const PM_MW = ['성인 저녁반', '김동욱 · 김민지', 'pm_mw'], PM_TT = ['성인 저녁반', '김동욱 · 이동찬', 'pm_tt'];
  const row = (time, end, mw, tt) => ({ time, end, cells: [mw, tt, mw, tt] });
  window.BD_SCHEDULE = [
    { section: 'MORNING · 성인 오전반' },
    row('09:00', '10:00', AM_MW, AM_TT),
    row('10:00', '11:00', AM_MW, AM_TT),
    row('11:00', '12:00', AM_MW, AM_TT),
    { section: 'AFTERNOON · 유소년반' },
    row('15:00', '16:00', JR_MW, JR_TT),
    row('16:00', '17:00', JR_MW, JR_TT),
    row('17:00', '18:00', JR_MW, JR_TT),
    { section: 'EVENING · 성인 저녁반' },
    row('18:30', '19:30', PM_MW, PM_TT),
    row('19:30', '20:30', PM_MW, PM_TT),
    row('20:30', '21:30', PM_MW, PM_TT),
    row('21:30', '22:30', PM_MW, PM_TT),
  ];
})();
