/* ============================================================
   대관 예약 (배드민턴·요가 페이지 #rental) — 설정은 booking-config.js(window.BOOKING), 모양은 booking.css
   01 월 달력(날짜) → 02 시간 × 코트 표(칸 = '선택' / '—') → 아래 고정 요약 바 [예약 확인 →] → 03 신청 폼
   한 신청 = 날짜 하나 + 이어진 시간 범위 하나 + 코트 1~3개(여러 코트는 반드시 같은 시간). 코트를 모두 고르면 '전체대관'.
   신청은 1코트 1시간 칸(items = 선택 코트 × 범위 칸, court 는 0부터) 단위로 관리프로그램 /api/site 에 보냄 — api 가 비면 문자 접수.
   ============================================================ */
(function () {
  const root = document.getElementById('bk');
  if (!root) return;
  const CFG = window.BOOKING;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const won = n => n.toLocaleString('ko-KR') + '원';
  const toDate = s => new Date(s + 'T12:00:00');
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dayLabel = s => { const d = toDate(s); return `${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]})`; };

  const space = root.querySelector('[data-space]').dataset.space;
  const SP = CFG.spaces[space];
  const NC = SP.courts.length;
  const ALL = SP.courts.map((_, i) => i);
  const MAX = CFG.maxItems || 72;                                         // 한 번에 신청할 수 있는 최대 칸 (코트 × 시간)
  const COURT_MAX = Math.max(1, Math.min(CFG.maxCourts || NC, NC));      // 같이 고를 수 있는 코트 수
  const CAN_WHOLE = NC > 1 && COURT_MAX >= NC;                            // '3면 동시 가능' 보기 · 전체대관을 쓸 수 있는지
  const WHOLE = CFG.wholeLabel || '전체대관';

  /** 코트 이름 묶음 — [0, 2] → "COURT 1·3" (이름이 "앞부분 + 숫자" 꼴이 아니면 쉼표로 나열) */
  function courtLabel(cs) {
    const m = cs.map(c => /^(.*?)\s*(\d+)$/.exec(SP.courts[c]));
    return m.every(x => x && x[1] === m[0][1]) ? `${m[0][1]} ${m.map(x => x[2]).join('·')}`.trim() : cs.map(c => SP.courts[c]).join(', ');
  }
  /** 신청의 코트 표시 — 코트를 모두 고르면 '전체대관' */
  const courtText = cs => (NC > 1 && cs.length === NC ? WHOLE : courtLabel(cs));
  /** 끝 글자 받침 번호 — 0 없음 · 8 ㄹ · 그 밖 (숫자는 읽는 소리: 영·일·삼·육·칠·팔, 영문 등은 없음으로) */
  function jong(w) {
    const ch = String(w).trim().slice(-1);
    if (/\d/.test(ch)) return { 0: 21, 1: 8, 3: 16, 6: 1, 7: 8, 8: 8 }[ch] || 0;
    const k = ch.charCodeAt(0) - 0xac00;
    return k >= 0 && k <= 11171 ? k % 28 : 0;
  }
  /** 은/는 — 'COURT 2는' · 'COURT 1은' · '전체대관은' */
  const eun = w => (jong(w) ? '은' : '는');
  /** 으로/로 — ㄹ 받침은 '로' — '전체대관으로' · 'COURT 1로' */
  const ro = w => (jong(w) && jong(w) !== 8 ? '으로' : '로');

  /* ---------- 시간 칸 · 예약 현황 ---------- */
  /** 그 날짜에 예약 가능한 시간 칸 [{start, end}] — '이어진' 은 이 목록의 인접 순서(index) 기준 (요가 10분 쉬는 시간도 이어진 칸) */
  const slotsFor = date => (SP.slots[toDate(date).getDay()] || []).map(s => { const [start, end] = s.split('-'); return { start, end }; });
  const todayStr = () => ymd(new Date());
  const isPast = (date, start) => {
    const now = new Date(), t = ymd(now);
    return date < t || (date === t && mins(start) <= now.getHours() * 60 + now.getMinutes());
  };
  const booked = {};    // 날짜 -> Set("코트|시작") — 관리프로그램이 알려준 막힌 칸(예약 · 레슨 시간). 없으면 아직 안 불러옴
  const loading = {};   // 날짜 -> 진행 중인 조회
  const ready = date => !CFG.api || !!booked[date];
  /** 그 칸을 그 코트로 신청할 수 있는지 — 지난 시간 · 예약된 칸 · 레슨 시간이면 false */
  function free(date, i, c, list = slotsFor(date)) {
    const x = list[i];
    return !!x && !isPast(date, x.start) && !(booked[date] && booked[date].has(`${c}|${x.start}`));
  }
  /** lo~hi 칸이 코트 cs 모두에 비어 있는지 */
  function freeRange(date, lo, hi, cs) {
    const list = slotsFor(date);
    for (let i = lo; i <= hi; i++) if (!cs.every(c => free(date, i, c, list))) return false;
    return true;
  }

  /* ---------- 상태 ----------
     date: 보고 있는 날짜, month: 달력에서 보고 있는 달("YYYY-MM"), view: 'all' 코트별 | 'whole' 모든 코트가 빈 시간만(전체대관)
     sel: 담은 신청 { date, courts: [코트 index 오름차순], s, e } — s~e 는 그 날 시간 칸 index (양 끝 포함), 없으면 null
          날짜를 바꿔 보기만 해서는 지우지 않음 (다른 날 칸을 누르면 새로 잡힘)
     focus: 키보드로 움직이는 칸 { c: 열, i: 줄 } (표 안에서 Tab 이 머무는 칸 하나 — 화살표로 이동)
     scroll: 다음에 표를 그릴 때 상자 안 스크롤을 처음 위치(오늘 지금 시각 · 첫 빈 칸 · 담은 시간)로 맞출지
     lost: 그 사이 막혀서 지운 신청 { date, courts, s } — '시간 다시 고르기' 때 그 줄로 표를 보여줌 (새로 담으면 지움)
     sending: 예약 신청을 보내는 중 — 그동안 표 · 선택 해제는 바꾸지 않고 신청 버튼도 다시 켜지지 않음 */
  const state = { date: todayStr(), month: '', view: 'all', sel: null, focus: null, scroll: true, lost: null, sending: false };
  const hoursOf = sel => sel.e - sel.s + 1;          // 칸 수 = 시간 수 (요가 50분 칸도 1시간 단위)
  const cellsOf = sel => sel.courts.length * hoursOf(sel);
  const priceOf = sel => cellsOf(sel) * SP.price;
  function timeText(sel) {
    const l = slotsFor(sel.date);
    return `${l[sel.s].start}~${l[sel.e].end} (${hoursOf(sel)}시간)`;
  }
  const rangeOnly = sel => { const l = slotsFor(sel.date); return `${l[sel.s].start}~${l[sel.e].end}`; };
  /** 안내용 "COURT 1·2 10:00~18:00 (8시간)" (요가는 코트 없이) */
  const selText = sel => `${NC > 1 ? courtText(sel.courts) + ' ' : ''}${timeText(sel)}`;
  /** "10월 16일(금) · COURT 1·2 · 10:00~18:00 (8시간)" (요가는 코트 없이) */
  const head = sel => [dayLabel(sel.date), NC > 1 ? courtText(sel.courts) : '', timeText(sel)].filter(Boolean).join(' · ');
  /** 요약 한 줄 "10월 16일(금) · COURT 1·2 · 10:00~18:00 (8시간) · 844,800원" */
  const summary = sel => `${head(sel)} · ${won(priceOf(sel))}`;
  /** 담은 신청이 아직 그대로 신청 가능한지 (그 사이 지난 시간 · 새로 들어온 예약) */
  const selOk = sel => !ready(sel.date) || freeRange(sel.date, sel.s, sel.e, sel.courts);

  /* ---------- 안내 ----------
     화면낭독기 안내는 #bkLive(role=status) 한 곳 — 칸마다 aria-pressed 가 바뀌어도 범위 전체는 읽히지 않으므로 결과를 한 줄로.
     눈에 보이는 경고는 아래 고정 바 위에 잠깐 띄움(#bkWarn) — 표를 누르는 동안 바는 늘 화면 아래에 있음 */
  const live = $('bkLive');
  const say = t => { if (t) live.textContent = live.textContent === t ? t + ' ' : t; };   // 같은 문구가 이어져도 다시 읽히게
  let warnTimer = 0;
  function flashWarn(text) {
    const w = $('bkWarn');
    w.textContent = text; w.classList.add('show');
    clearTimeout(warnTimer); warnTimer = setTimeout(() => w.classList.remove('show'), 3200);
  }
  /** 다음 동작이 잘 되면 남아 있던 경고는 바로 내림 (지금 상태와 안 맞는 경고가 3초 남지 않게) */
  function hideWarn() { clearTimeout(warnTimer); $('bkWarn').classList.remove('show'); }
  const DATE_WARN = '날짜를 바꾸면 담은 시간이 새로 잡혀요';
  const GAP_WARN = '중간에 예약된 시간이 있어 이어서 선택할 수 없어요 · 누른 칸부터 새로 선택했어요';
  const LOST_WARN = '그 사이 예약된 시간이 있어요. 다시 골라주세요';
  const PAST_WARN = '선택한 시간이 지났어요. 다시 골라주세요';
  const MAX_WARN = `한 번에 최대 ${MAX}칸(코트 × 시간)까지 신청할 수 있어요. 나눠서 신청해주세요`;
  const ANCHOR_TIP = '끝 시간을 누르면 이어서 선택돼요';
  const COURT_MAX_WARN = `코트는 최대 ${COURT_MAX}면까지 함께 신청할 수 있어요`;
  const SENDING_WARN = '예약 신청을 보내는 중이에요. 잠시만 기다려주세요';
  const busyWarn = (c, sel) => `${SP.courts[c]}${eun(SP.courts[c])} ${rangeOnly(sel)} 중 예약된 시간이 있어요`;

  /* ---------- 날짜 (월 달력) ----------
     예약 가능 범위: 오늘 ~ 오늘 + CFG.days - 1 (약 2달). 범위가 걸친 달 사이만 ‹ › 로 이동.
     지난 날 · 범위 밖 · 그 공간에 대관 칸이 없는 요일(요가센터 주말)은 disabled. 담은 시간이 있는 날엔 작은 점 */
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const lastDay = () => { const d = today0(); d.setDate(d.getDate() + CFG.days - 1); return d; };
  const ym = d => ymd(d).slice(0, 7);
  const inRange = v => v >= ymd(today0()) && v <= ymd(lastDay());
  const selLabel = s => { const d = toDate(s); return `${d.getMonth() + 1}. ${d.getDate()}. (${WD[d.getDay()]})`; };

  function renderCal() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());        // 그 주 일요일부터 6주
    const tv = ymd(today0()), minM = ym(today0()), maxM = ym(lastDay()), has = state.sel && state.sel.date;
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const v = ymd(d), wd = d.getDay();
      const off = !inRange(v) || !slotsFor(v).length;
      const cls = [d.getMonth() !== m - 1 ? 'out' : '', wd === 0 ? 'sun' : wd === 6 ? 'sat' : '', v === state.date ? 'on' : '', v === has ? 'bk2-has' : ''].filter(Boolean).join(' ');
      cells += `<button type="button" data-date="${v}" class="${cls}"${off ? ' disabled' : ''} aria-label="${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일${off ? ' (예약 불가)' : ''}${v === has ? ' (담은 시간 있음)' : ''}" aria-pressed="${v === state.date}">
        <b>${d.getDate()}</b>${v === tv ? '<small>오늘</small>' : ''}</button>`;
    }
    $('bkCal').innerHTML = `
      <div class="bk-cal-h">
        <button type="button" data-nav="-1" aria-label="이전 달"${state.month <= minM ? ' disabled' : ''}>‹</button>
        <b>${y}.${pad(m)}</b>
        <button type="button" data-nav="1" aria-label="다음 달"${state.month >= maxM ? ' disabled' : ''}>›</button>
      </div>
      <div class="bk-cal-wd">${WD.map((w, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div>
      <div class="bk-cal-g">${cells}</div>
      <div class="bk-cal-sel"><span>선택한 날짜</span>${selLabel(state.date)}</div>`;
  }
  /** 선택된 날짜가 예약 불가(칸 없음 · 범위 밖)면 가장 가까운 가능한 날짜로 옮기고, 달력 월을 선택 날짜에 맞춤 */
  function ensureDate() {
    if (!inRange(state.date) || !slotsFor(state.date).length) {
      for (let i = 0; i < CFG.days; i++) {
        const d = today0(); d.setDate(d.getDate() + i);
        if (slotsFor(ymd(d)).length) { state.date = ymd(d); break; }
      }
    }
    state.month = state.date.slice(0, 7);
  }
  /** 날짜 바꿔 보기 — 담은 시간은 그대로 둠 (그 날 칸을 누를 때 새로 잡음) */
  function goDate(v) {
    if (v !== state.date) { state.date = v; state.focus = null; state.scroll = true; }
    state.month = v.slice(0, 7);
    renderCal(); renderGrid();
    load(v);
  }
  $('bkCal').addEventListener('click', e => {
    const cal = $('bkCal');
    const nav = e.target.closest('button[data-nav]');
    if (nav) {
      if (nav.disabled) return;
      const [y, m] = state.month.split('-').map(Number);
      const next = ym(new Date(y, m - 1 + Number(nav.dataset.nav), 1));
      if (next < ym(today0()) || next > ym(lastDay())) return;   // 오늘이 속한 달 ~ 범위 마지막 달 사이만
      state.month = next;
      renderCal();
      const again = cal.querySelector(`[data-nav="${nav.dataset.nav}"]`);
      (again && !again.disabled ? again : cal.querySelector('[data-nav]:not(:disabled)') || cal).focus();   // 다시 그린 버튼으로 키보드 포커스 유지
      return;
    }
    const b = e.target.closest('button[data-date]'); if (!b || b.disabled) return;
    goDate(b.dataset.date);
    const again = cal.querySelector(`[data-date="${b.dataset.date}"]`);
    if (again) again.focus();
  });

  /* ---------- 표 (세로 = 시간 칸, 가로 = 코트) ---------- */
  /** 지금 보기의 열 — 코트별 보기는 코트마다 한 열, '3면 동시 가능' 보기는 모든 코트를 묶은 '전체대관' 한 열 */
  const cols = () => (state.view === 'whole'
    ? [{ courts: ALL, name: WHOLE, sub: courtLabel(ALL) }]
    : ALL.map(c => ({ courts: [c], name: SP.courts[c] })));
  /** 그 날 sel (보고 있는 날짜에 담은 게 없으면 null) */
  const selHere = () => (state.sel && state.sel.date === state.date ? state.sel : null);
  /** 선택 안 된 코트 c 를 지금 범위에 더할 수 있는지 (코트별 보기의 '+ 추가' 표시) */
  function canAdd(sel, c) {
    return sel.courts.length < COURT_MAX && (sel.courts.length + 1) * hoursOf(sel) <= MAX && freeRange(sel.date, sel.s, sel.e, [c]);
  }
  /** 칸 모양 — cls: '' 빈 칸('선택') · off('—': 지난 시간 · 예약됨 · 레슨) · on(담김, s 시작 · e 끝) · add(선택 안 된 코트의 범위 줄 — 누르면 같은 시간으로 추가)
      · part(전체대관 보기에서 일부 코트만 담긴 범위 — 누르면 나머지 코트도 담음) · wait(예약 현황 불러오는 중) */
  function cellView(col, i, list) {
    const D = state.date, x = list[i], t = `${x.start}~${x.end}`, sel = selHere();
    if (!ready(D)) return { cls: 'wait', text: '', off: true, label: `${col.name} ${t} 불러오는 중` };
    const inR = sel && i >= sel.s && i <= sel.e;
    if (inR && col.courts.every(c => sel.courts.includes(c))) {
      const mark = i === sel.s ? '시작' : i === sel.e ? '끝' : '';
      // j: 시작 바로 다음 칸이 끝(2칸 범위) — 블루 두 칸 사이 이음 띠도 블루로
      return { cls: 'on' + (i === sel.s ? ' s' : '') + (i === sel.e ? ' e' : '') + (i === sel.e && i === sel.s + 1 ? ' j' : ''), text: mark, pressed: 'true',
        label: `${col.name} ${t} 선택됨${mark ? ` (${mark})` : ''}` };
    }
    if (inR && state.view === 'whole') {
      return { cls: 'part', text: `${courtLabel(sel.courts)}만`, pressed: 'mixed', label: `${col.name} ${t} ${courtLabel(sel.courts)}만 선택됨, 누르면 ${WHOLE}${ro(WHOLE)}` };
    }
    if (!col.courts.every(c => free(D, i, c, list))) {
      return { cls: 'off', text: '—', off: true, label: `${col.name} ${t} ${isPast(D, x.start) ? '지난 시간' : '예약 마감'}` };
    }
    if (inR && state.view === 'all' && canAdd(sel, col.courts[0])) {
      return { cls: 'add', text: '+ 추가', label: `${col.name} ${t} 선택 가능, 누르면 같은 시간으로 추가` };
    }
    return { cls: '', text: '선택', label: `${col.name} ${t} 선택 가능` };
  }
  /** 그 사이 막혀서 지운 신청이 이 날 것이면 그것 (표를 그 줄로 보여주려고) */
  const lostHere = () => (!selHere() && state.lost && state.lost.date === state.date ? state.lost : null);
  /** 키보드 포커스 기본 칸 — 담은 범위 시작 · 막혀서 지운 범위 시작 · 처음 보여줄 줄의 첫 빈 칸 · 맨 위 */
  function defaultFocus(list, cs) {
    const sel = selHere() || lostHere();
    if (sel && sel.s < list.length) {
      const c = cs.findIndex(col => col.courts.every(k => sel.courts.includes(k)));
      return { c: c >= 0 ? c : Math.max(0, cs.findIndex(col => col.courts.includes(sel.courts[0]))), i: sel.s };
    }
    for (let i = startRow(list); i < list.length; i++) {
      const c = cs.findIndex(col => col.courts.every(k => free(state.date, i, k, list)));
      if (c >= 0) return { c, i };
    }
    return { c: 0, i: 0 };
  }
  /** 처음 보여줄 줄 — 담은(또는 막혀서 지운) 시간이 이 날이면 그 시작 바로 위, 오늘이면 지금 시각 줄, 아니면 첫 빈 칸 줄 */
  function startRow(list) {
    const D = state.date, sel = selHere() || lostHere();
    if (sel && sel.s < list.length) return Math.max(0, sel.s - 1);
    if (D === todayStr()) {
      const i = list.findIndex(x => !isPast(D, x.start));
      return i < 0 ? Math.max(0, list.length - 1) : Math.max(0, i - 1);
    }
    const i = list.findIndex((x, k) => cols().some(col => col.courts.every(c => free(D, k, c, list))));
    return i < 0 ? 0 : i;
  }
  /** 표 상자 안에서만 스크롤 (페이지 스크롤은 그대로). 표가 숨은 탭에 있으면(높이 0) 보일 때 ResizeObserver 가 다시 부름 */
  function scrollStart() {
    const box = $('bkScroll'), grid = $('bkGrid'), list = slotsFor(state.date);
    if (!state.scroll || !ready(state.date) || !list.length || !box.clientHeight || !grid.tBodies[0]) return;
    state.scroll = false;
    const row = grid.tBodies[0].rows[startRow(list)];
    if (row) box.scrollTop += row.getBoundingClientRect().top - box.getBoundingClientRect().top - grid.tHead.offsetHeight;
  }
  function renderGrid() {
    const D = state.date, list = slotsFor(D), grid = $('bkGrid'), cs = cols(), sel = selHere();
    $('bkDay').textContent = dayLabel(D);
    root.querySelectorAll('#bkView [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('bkClear').hidden = !state.sel;
    // 다른 날에 담아 둔 시간 — 이 날 칸을 누르면 새로 잡힌다는 것도 미리 알려 둠
    const other = state.sel && !sel;
    $('bkElse').hidden = !other;
    if (other) {
      $('bkElse').innerHTML = `<span>담아 둔 시간 <b>${esc(head(state.sel))}</b> · 이 날 칸을 누르면 새로 잡혀요</span><button type="button" data-go>그 날 보기</button>`;
    }
    $('bkEmpty').hidden = list.length > 0;
    if (!list.length) { grid.innerHTML = ''; return; }
    const had = grid.contains(document.activeElement);
    let f = state.focus;
    if (!f || f.c >= cs.length || f.i >= list.length) f = state.focus = defaultFocus(list, cs);
    const ths = cs.map(col => {
      const on = sel && col.courts.every(c => sel.courts.includes(c));
      return `<th scope="col"${on ? ' class="on"' : ''}>${esc(col.name)}${col.sub ? `<small>${esc(col.sub)}</small>` : ''}</th>`;
    }).join('');
    const rows = list.map((x, i) => `<tr><th scope="row" class="bk2-t"><b>${x.start}</b><small>~${x.end}</small></th>${cs.map((col, c) => {
      const v = cellView(col, i, list);
      return `<td><button type="button" class="bk2-c ${v.cls}" data-c="${c}" data-i="${i}" tabindex="${f.c === c && f.i === i ? 0 : -1}"`
        + `${v.off ? ' aria-disabled="true"' : ` aria-pressed="${v.pressed || 'false'}"`} aria-label="${esc(v.label)}">${v.text}</button></td>`;
    }).join('')}</tr>`).join('');
    grid.innerHTML = `<caption class="bk-sr">${esc(dayLabel(D))} ${esc(SP.name)} 대관 시간표 — 칸을 눌러 선택</caption>`
      + `<thead><tr><th scope="col" class="bk2-t"><span class="bk-sr">시간</span></th>${ths}</tr></thead><tbody>${rows}</tbody>`;
    grid.setAttribute('aria-busy', String(!ready(D)));
    if (had) focusCell(f.c, f.i, true);   // 다시 그려도 키보드 포커스 유지
    scrollStart();
  }
  /** 화면에서 가리는 곳 — 위: 떠 있는 메뉴(nav) · 대관/레슨 탭의 아래 끝, 아래: 고정 요약 바의 위 끝 */
  function cover() {
    const top = Math.max(0, ...['nav', 'secTabs'].map($).filter(Boolean).map(e => e.getBoundingClientRect().bottom));
    const bar = $('bkBar').getBoundingClientRect();
    return { top, bottom: Math.min(innerHeight, bar.height ? bar.top : innerHeight) };
  }
  /** 키보드로 옮긴 칸이 가려지지 않게 — 브라우저 기본 focus 스크롤은 위 탭 · 아래 고정 바에 가린 칸을 그냥 둠.
      1) 표 상자 안에서 머리줄(코트) 아래로 2) 페이지에서 탭 아래 ~ 바 위로 (상자가 통째로 들어가면 상자째 — 머리줄도 보이게) */
  function reveal(b) {
    const box = $('bkScroll'), hh = $('bkGrid').tHead ? $('bkGrid').tHead.offsetHeight : 0;
    let br = box.getBoundingClientRect(), r = b.getBoundingClientRect();
    if (r.top < br.top + hh) box.scrollTop -= br.top + hh - r.top + 4;
    else if (r.bottom > br.bottom) box.scrollTop += r.bottom - br.bottom + 4;
    const { top, bottom } = cover();
    br = box.getBoundingClientRect(); r = b.getBoundingClientRect();
    const fits = br.height <= bottom - top, lo = fits ? br.top : r.top - 4, hi = fits ? br.bottom : r.bottom + 4;
    const d = lo < top ? lo - top : hi > bottom ? hi - bottom : 0;
    if (d) window.scrollBy({ top: d, behavior: 'instant' });
  }
  function focusCell(c, i, keep) {
    const grid = $('bkGrid'), b = grid.querySelector(`button[data-c="${c}"][data-i="${i}"]`);
    if (!b) return;
    grid.querySelectorAll('button[tabindex="0"]').forEach(x => { if (x !== b) x.tabIndex = -1; });
    b.tabIndex = 0; state.focus = { c, i };
    b.focus({ preventScroll: true });
    if (!keep) reveal(b);
  }
  // 화살표 · Home/End · PageUp/PageDown 으로 칸 이동 (Enter · Space 는 버튼 그대로 누름)
  $('bkGrid').addEventListener('keydown', e => {
    const b = e.target.closest('button.bk2-c'); if (!b) return;
    const nc = cols().length, nr = slotsFor(state.date).length;
    let c = +b.dataset.c, i = +b.dataset.i;
    switch (e.key) {
      case 'ArrowUp': i--; break;
      case 'ArrowDown': i++; break;
      case 'ArrowLeft': c--; break;
      case 'ArrowRight': c++; break;
      case 'Home': if (e.ctrlKey) i = 0; else c = 0; break;
      case 'End': if (e.ctrlKey) i = nr - 1; else c = nc - 1; break;
      case 'PageUp': i -= 6; break;
      case 'PageDown': i += 6; break;
      default: return;
    }
    e.preventDefault();
    focusCell(Math.max(0, Math.min(nc - 1, c)), Math.max(0, Math.min(nr - 1, i)));
  });
  $('bkGrid').addEventListener('click', e => {
    const b = e.target.closest('button.bk2-c'); if (!b) return;
    const c = +b.dataset.c, i = +b.dataset.i;
    state.focus = { c, i };
    pick(cols()[c], i);
    // 키보드(Enter · Space)로 눌렀으면 바뀐 요약 바(줄 수가 늘 수 있음)에 칸이 가리지 않게
    const a = document.activeElement;
    if (!e.detail && a && a.closest('#bkGrid')) reveal(a);
  });

  /* 칸 누름 — 결과는 sel 하나만 바꿈 (한 신청 = 날짜 하나 · 이어진 범위 하나 · 같은 시간의 코트 1~3개)
     - '—' 칸은 아무 일 없음 (단, 코트별 보기에서 선택 안 된 코트의 범위 줄 '—' 칸 → 그 코트를 더할 수 없는 까닭을 안내)
     - 신청을 보내는 중이면 바꾸지 않음. 다른 날짜에 담아 둔 게 있으면 지우고 이 날짜에서 새로 시작
     - 담은 게 없음 → 그 열(코트 · 전체대관)의 그 칸 1칸 = 시작점
     - 선택된 열:
         첫 칸(1칸뿐인 시작점 포함) → 그 열의 코트를 뺌 (마지막 코트면 전부 해제)
         시작점(1칸)만 있을 때 다른 칸 → 시작~그 칸 (앞뒤 방향, 모든 선택 코트에 같이). 사이에 막힌 칸이 있으면 안내 후 누른 칸에서 새로 시작
         범위 안 다른 칸 → 시작~그 칸으로 줄임 (모든 선택 코트 같이) / 끝 칸 → 그대로 / 범위 밖 → 전부 지우고 그 칸에서 새로 시작
     - 코트별 보기에서 선택 안 된 코트 열의 아무 칸 → 그 코트를 '같은 시간 범위'로 추가 (범위 중 막힌 칸이 있으면 안내만).
       범위 밖 줄을 눌렀으면 표를 범위로 올려 보여주고 포커스도 그 코트의 시작 칸으로
     - 전체대관 보기에서 일부 코트만 담긴 범위 줄 → 나머지 코트도 담아 전체대관 (막혔으면 안내만), 범위 밖 → 전체대관으로 새로 시작
     - 바뀐 뒤 칸 수(코트 × 시간)가 MAX 를 넘으면 안내 후 바꾸지 않음 */
  function pick(col, i) {
    const D = state.date, list = slotsFor(D);
    if (!list[i]) return;
    if (state.sending) { flashWarn(SENDING_WARN); say(SENDING_WARN); return; }
    const v = cellView(col, i, list), here = selHere();
    if (v.off) {
      if (v.cls === 'off' && here && state.view === 'all' && i >= here.s && i <= here.e && !isPast(D, list[i].start)
        && !col.courts.every(c => here.courts.includes(c))) {
        const w = here.courts.length >= COURT_MAX ? COURT_MAX_WARN : busyWarn(col.courts[0], here);
        flashWarn(w); say(w);
      }
      return;
    }
    let sel = state.sel, warn = '', said = '', next, jump = false;
    if (sel && sel.date !== D) { sel = null; warn = DATE_WARN; }
    const lone = () => ({ date: D, courts: col.courts.slice(), s: i, e: i });
    if (!sel) {
      next = lone(); said = `${selText(next)} 선택됨. ${ANCHOR_TIP}`;
    } else {
      const mine = col.courts.every(c => sel.courts.includes(c)), inR = i >= sel.s && i <= sel.e;
      if (mine && i === sel.s) {
        const left = sel.courts.filter(c => !col.courts.includes(c));
        next = left.length ? { ...sel, courts: left } : null;
        said = next ? `${courtLabel(col.courts)} 선택 해제. ${selText(next)} 남음` : `${selText(sel)} 선택 해제`;
      } else if (mine && sel.s === sel.e) {
        const lo = Math.min(sel.s, i), hi = Math.max(sel.s, i);
        if (freeRange(D, lo, hi, sel.courts)) { next = { ...sel, s: lo, e: hi }; said = `${selText(next)} 선택됨`; }
        else { warn = GAP_WARN; next = lone(); said = `${selText(next)} 새로 선택됨. ${ANCHOR_TIP}`; }
      } else if (mine && inR) {
        if (i === sel.e) { next = sel; said = `끝 칸이라 그대로예요. ${selText(sel)}`; }
        else { next = { ...sel, e: i }; said = `${selText(next)}으로 줄었어요`; }
      } else if (mine) {
        next = lone(); said = `이전 선택 해제. ${selText(next)} 선택됨. ${ANCHOR_TIP}`;
      } else if (state.view === 'whole') {
        if (inR) {
          const miss = ALL.filter(c => !sel.courts.includes(c));
          const busy = miss.filter(c => !freeRange(D, sel.s, sel.e, [c]));
          if (busy.length) { warn = `${courtLabel(busy)}${eun(courtLabel(busy))} ${rangeOnly(sel)} 중 예약된 시간이 있어요`; next = sel; }
          else { next = { ...sel, courts: ALL.slice() }; said = `${WHOLE} 선택됨. ${selText(next)}`; }
        } else {
          next = lone(); said = `이전 선택 해제. ${selText(next)} 선택됨. ${ANCHOR_TIP}`;
        }
      } else {
        const c = col.courts[0];
        if (sel.courts.length >= COURT_MAX) { warn = COURT_MAX_WARN; next = sel; }
        else if (!freeRange(D, sel.s, sel.e, [c])) { warn = busyWarn(c, sel); next = sel; }
        else {
          next = { ...sel, courts: sel.courts.concat(c).sort((a, b) => a - b) }; said = `${SP.courts[c]} 추가. ${selText(next)}`;
          jump = !inR;
        }
      }
    }
    if (next && next !== sel && cellsOf(next) > MAX) {   // 넘으면 하나도 안 바꿈
      flashWarn(MAX_WARN); say(MAX_WARN);
      return;
    }
    if (next !== state.sel) clearDraft();   // 끝 칸을 다시 누른 것처럼 그대로면 문자 신청 초안도 그대로
    state.sel = next; state.lost = null;
    // 범위 밖 줄을 눌러 코트를 더했으면 바뀐 범위가 화면 밖 — 표 상자를 범위 시작으로 옮기고 포커스도 그 코트의 시작 칸으로
    if (jump && state.focus) { state.focus = { c: state.focus.c, i: next.s }; state.scroll = true; }
    update();
    if (warn) flashWarn(warn); else hideWarn();
    say([warn, said].filter(Boolean).join('. '));
  }

  /** 담은 신청이 그 사이 막혔으면(지난 시간 · 새 예약) 지우고 안내. 그대로면 true */
  function keepSel() {
    const sel = state.sel;
    if (!sel || selOk(sel)) return true;
    const past = slotsFor(sel.date).slice(sel.s, sel.e + 1).some(x => isPast(sel.date, x.start));
    lose(past ? PAST_WARN : LOST_WARN);
    return false;
  }
  /** 담은 신청을 지우고 안내. 지운 범위는 state.lost 로 기억('시간 다시 고르기' 때 그 줄로).
      sent: 보냈다가 막힌 신청 — 그 신청의 날짜 예약 현황을 다시 불러오고, 화면낭독기 안내는 신청 결과(#bkMsg) 쪽 한 번만 */
  function lose(text, sent) {
    const sel = sent || state.sel;
    if (!sel) return;
    state.lost = { date: sel.date, courts: sel.courts.slice(), s: sel.s };
    if (state.sel === sel) state.sel = null;
    if (sent) delete booked[sel.date];
    update();
    flashWarn(text);
    if (sent) load(sel.date); else say(text);
  }

  /* ---------- 아래 고정 요약 바 · 신청 요약 ---------- */
  function renderBar() {
    const sel = state.sel;
    $('bkBar').classList.toggle('has', !!sel);
    $('bkBarMain').textContent = sel ? [dayLabel(sel.date), NC > 1 ? courtText(sel.courts) : ''].filter(Boolean).join(' · ') : '예약 시간을 선택하세요';
    $('bkBarSub').textContent = sel ? `${timeText(sel)} · ${won(priceOf(sel))}` : `원하는 ${NC > 1 ? '코트를' : '시간을'} 누르면 선택됩니다`;
    $('bkGo').disabled = !sel;
  }
  function renderSel() {
    const sel = state.sel;
    $('bkSel').innerHTML = sel
      ? `<div class="bk2-sel-h">선택한 예약</div>
        <dl>
          <div><dt>날짜</dt><dd>${esc(dayLabel(sel.date))}</dd></div>
          ${NC > 1 ? `<div><dt>코트</dt><dd>${esc(courtText(sel.courts))}${sel.courts.length === NC ? ` <small>(${esc(courtLabel(ALL))})</small>` : ''}</dd></div>` : ''}
          <div><dt>시간</dt><dd>${esc(timeText(sel))}</dd></div>
          <div><dt>금액</dt><dd><b class="bk2-won">${won(priceOf(sel))}</b><small>${esc(SP.unit)} ${won(SP.price)} × ${cellsOf(sel)}</small></dd></div>
        </dl>
        <button type="button" class="bk2-edit" data-edit>시간 바꾸기 ↑</button>`
      : `<p class="bk2-sel-empty">아직 고른 시간이 없어요. 위 표에서 ${NC > 1 ? '코트와 ' : ''}시간을 골라주세요.</p>
        <button type="button" class="bk2-edit" data-edit>시간 고르기 ↑</button>`;
  }
  function update() { renderCal(); renderGrid(); renderBar(); renderSel(); validate(); }

  /** 표로 돌아가기 — 담은(또는 막혀서 지운) 날짜로 바꿔 보여주고 그 시작 칸에 포커스 */
  function backToGrid() {
    const d = state.sel ? state.sel.date : state.lost && state.lost.date;
    if (d && d !== state.date) goDate(d);
    else { state.focus = null; state.scroll = true; renderGrid(); }
    $('bkCard').scrollIntoView({ block: 'start' });
    const f = state.focus;
    if (f) focusCell(f.c, f.i, true);
  }
  $('bkGo').addEventListener('click', () => {
    if (!state.sel || !keepSel()) return;
    $('bkApply').scrollIntoView({ block: 'start' });
    const f = form.name.value.trim() ? (form.phone.value.trim() ? form.name : form.phone) : form.name;
    f.focus({ preventScroll: true });
    say(`${summary(state.sel)}. 이름과 연락처를 입력해 예약을 신청해주세요`);
  });
  $('bkSel').addEventListener('click', e => { if (e.target.closest('[data-edit]')) backToGrid(); });
  $('bkElse').addEventListener('click', e => { if (e.target.closest('[data-go]')) backToGrid(); });
  $('bkClear').addEventListener('click', () => {
    if (!state.sel) return;
    if (state.sending) { flashWarn(SENDING_WARN); say(SENDING_WARN); return; }
    const t = `${selText(state.sel)} 선택 해제`;
    state.sel = null; clearDraft(); update(); hideWarn();
    const f = state.focus; if (f) focusCell(f.c, f.i, true);   // 버튼이 사라지므로 표로 포커스
    say(t);
  });
  $('bkView').hidden = !CAN_WHOLE;
  const wholeBtn = root.querySelector('#bkView [data-view="whole"]');
  if (wholeBtn) wholeBtn.textContent = `${NC}면 동시 가능`;
  $('bkView').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]'); if (!b || b.dataset.view === state.view) return;
    state.view = b.dataset.view; state.focus = null;
    renderGrid(); hideWarn();
    say(state.view === 'whole' ? `${NC}면 동시 가능 보기 — 모든 코트가 빈 시간만 고를 수 있어요 (${WHOLE})` : '전체 보기 — 코트별 시간');
  });

  /* ---------- 신청 폼 ---------- */
  const form = $('bkForm');
  function validate() {
    const ok = !!state.sel && cellsOf(state.sel) <= MAX && form.name.value.trim() && /^[0-9\-+ ]{9,}$/.test(form.phone.value.trim()) && form.agree.checked;
    $('bkSubmit').disabled = !ok || state.sending;   // 보내는 중엔 입력 · 표 변화로 다시 켜지지 않게 (두 번 신청 방지)
    return ok && !state.sending;
  }
  form.addEventListener('input', validate);
  form.addEventListener('change', validate);

  function message(sel) {
    return [
      '[THE SQUARE 대관 예약 신청]',
      `공간: ${SP.name}`,
      `예약: ${head(sel)}`,
      `합계: ${won(priceOf(sel))} (${SP.unit} × ${cellsOf(sel)})`,
      `이름: ${form.name.value.trim()}`,
      `연락처: ${form.phone.value.trim()}`,
      form.people.value ? `인원: ${form.people.value}명` : '',
      form.memo.value.trim() ? `요청사항: ${form.memo.value.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  /** 신청 결과 안내 — 폼 아래(#bkMsg)에 보이고, 화면낭독기는 #bkLive 한 곳에서 읽음 (quiet: 안내 문단에 포커스를 줄 때 — 두 번 읽히지 않게) */
  function showMsg(html, cls, quiet) {
    const m = $('bkMsg');
    m.className = 'bk-msg ' + (cls || ''); m.innerHTML = html;
    if (!html || quiet) return;
    const t = m.cloneNode(true);   // 읽을 문구만 — 버튼 · 문자 초안(pre) 은 빼고
    t.querySelectorAll('button, pre, .bk-actions').forEach(x => x.remove());
    t.querySelectorAll('br').forEach(x => x.replaceWith(' '));
    say(t.textContent.replace(/\s+/g, ' ').trim());
  }
  /** 선택이 바뀌면 이전 문자 신청 초안 · 오류 안내는 지움 (내용이 달라지므로) */
  function clearDraft() { const m = $('bkMsg'); if (m.classList.contains('info') || m.classList.contains('err')) showMsg('', ''); }

  function copyText(text, btn, sel) {
    const ok = () => { btn.textContent = '복사됨 ✓'; };
    const legacy = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      let done = false; try { done = document.execCommand('copy'); } catch (e) { /* noop */ }
      ta.remove();
      if (done) return ok();
      const r = document.createRange(); r.selectNodeContents(sel);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      btn.textContent = '선택된 내용을 길게 눌러 복사해주세요';
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, legacy);
    else legacy();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate() || !keepSel()) return;
    const sel = state.sel, list = slotsFor(sel.date);
    const items = sel.courts.flatMap(c => list.slice(sel.s, sel.e + 1).map(x => ({ date: sel.date, court: c, start: x.start })));

    if (!CFG.api) {
      const text = message(sel);
      const sms = `sms:${SP.phone.replace(/-/g, '')}?&body=${encodeURIComponent(text)}`;
      showMsg(`<b>예약 내용을 문자로 보내주세요.</b><br>${esc(summary(sel))}<br>아래 버튼을 누르면 예약 내용이 문자로 작성됩니다. 전송해주시면 확인 후 연락드립니다.
        <pre>${esc(text)}</pre>
        <div class="bk-actions"><a class="bk-submit" href="${sms}">문자로 예약 신청</a>
        <button type="button" class="bk-copy">내용 복사</button></div>
        <small>PC에서는 내용을 복사해 ${SP.phone}로 문자 보내주세요.</small>`, 'info');
      const m = $('bkMsg');
      m.querySelector('.bk-copy').onclick = ev => copyText(text, ev.currentTarget, m.querySelector('pre'));
      return;
    }

    const btn = $('bkSubmit');
    state.sending = true;
    btn.disabled = true; btn.textContent = '신청 중…';
    let after = null;   // 끝난 뒤 할 일 (선택 지우기 등) — 버튼 문구를 되돌린 다음에. 결과는 보낸 신청(sel) 기준
    try {
      const res = await fetch(CFG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'book', space, items,
          name: form.name.value.trim(), phone: form.phone.value.trim(),
          people: form.people.value, memo: form.memo.value.trim(),
        }),
      });
      const r = await res.json();
      if (r.ok) {
        const done = summary(sel);
        if (state.sel === sel) state.sel = null;
        state.lost = null; form.reset();
        Object.keys(booked).forEach(k => delete booked[k]);
        after = quiet => {
          update(); load(state.date);
          showMsg(`<b>예약 신청이 접수되었습니다.</b><br>${esc(done)}<br>신청번호 ${esc(r.id)} · 확인 후 연락드립니다.`, 'ok', quiet);
        };
      } else if (r.error === 'conflict' || r.error === 'invalid_item') {
        const t = r.error === 'conflict' ? LOST_WARN : '선택한 날짜가 예약 범위를 벗어났어요. 날짜를 다시 선택해주세요';
        after = () => {
          lose(t, sel);   // 보낸 신청을 지우고 그 날 예약 현황을 다시 불러옴 (낭독은 아래 결과 안내 한 번)
          showMsg(`${esc(t)} <button type="button" class="bk2-edit" data-edit>시간 다시 고르기 ↑</button>`, 'err');
        };
      } else if (r.error === 'too_many') {
        showMsg(`한 번에 최대 ${esc(r.max || MAX)}칸(코트 × 시간)까지 신청할 수 있습니다. 나눠서 신청해주세요.`, 'err');
      } else if (r.error === 'pending_limit') {
        showMsg(`확인 전인 예약 신청이 많아 더 신청할 수 없습니다. 전화(${SP.phone})로 문의해주세요.`, 'err');
      } else throw new Error(r.error || 'fail');
    } catch (err) {
      showMsg(`예약 신청 중 오류가 발생했습니다. 전화(${SP.phone})로 문의해주세요.`, 'err');
    }
    state.sending = false;
    btn.textContent = '예약 신청';
    // 신청 중 버튼이 꺼지며 키보드 포커스가 빠졌으면(body) 되살림 — '시간 다시 고르기' · 다시 켜진 신청 버튼 · 결과 안내 문단
    const a = document.activeElement, dropped = !a || a === document.body || a === btn;
    validate();
    const m = $('bkMsg');
    if (after) after(dropped);
    if (dropped) {
      const edit = m.querySelector('[data-edit]');
      if (edit) edit.focus({ preventScroll: true });
      else if (!btn.disabled) btn.focus({ preventScroll: true });
      else if (m.textContent.trim()) { m.tabIndex = -1; m.focus({ preventScroll: true }); }
    }
  });
  $('bkMsg').addEventListener('click', e => { if (e.target.closest('[data-edit]')) backToGrid(); });

  /* ---------- 예약 현황 (관리프로그램 조회) ---------- */
  function load(date) {
    if (!CFG.api || booked[date] || loading[date]) return loading[date];
    loading[date] = (async () => {
      try {
        const r = await (await fetch(`${CFG.api}?action=slots&space=${encodeURIComponent(space)}&date=${date}`)).json();
        booked[date] = new Set((r.slots || []).map(x => `${x.court}|${x.start}`));
      } catch (e) {
        booked[date] = new Set();   // 조회 실패 — 전체 가능으로 표시 (신청 때 관리프로그램이 다시 확인)
      }
      delete loading[date];
      if (state.sel && state.sel.date === date && !keepSel()) return;   // 담은 시간이 그 사이 막혔으면 지우고 다시 그림
      if (date === state.date) renderGrid();
    })();
    return loading[date];
  }

  /* 아래 요약 바가 화면 아래에 붙지 않고 제자리(신청 폼 바로 위)에 있는데 그 자리가 위 메뉴 · 탭 밑이면 숨김
     — [예약 확인] 뒤 폼으로 내려왔을 때 반투명 메뉴 둘레 · 탭 아래로 네이비 띠가 비치지 않게 */
  let barRaf = 0;
  function tuckBar() {
    barRaf = 0;
    const bar = $('bkBar'), r = bar.getBoundingClientRect();
    bar.classList.toggle('tuck', r.height > 0 && r.bottom < innerHeight - 1 && r.top < cover().top + 1);
  }
  const onScroll = () => { if (!barRaf) barRaf = requestAnimationFrame(tuckBar); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  // 대관 탭이 처음엔 숨어 있으면(요가 페이지) 표 높이가 0 — 보이게 될 때 상자 안 스크롤을 처음 위치로
  if (window.ResizeObserver) new ResizeObserver(() => { scrollStart(); onScroll(); }).observe($('bkScroll'));

  ensureDate();
  $('bkGuide').textContent = SP.note || '';
  if (SP.title) $('bkTitle').textContent = SP.title;
  update();
  load(state.date);
})();
