/* ============================================================
   대관 예약 (배드민턴·요가 페이지 #rental) — 설정은 booking-config.js(window.BOOKING), 모양은 booking.css
   01 월 달력(날짜) → 02 시간 × 코트 표(칸 = '선택' / '—') → 아래 고정 요약 바 [예약 확인 →] → 03 신청 폼
   한 신청 = 이어진 시간 범위 하나 + 코트 1~3개(여러 코트는 반드시 같은 시간). 코트를 모두 고르면 '전체대관'.
   범위는 보통 날짜 하나 안이고, 배드민턴처럼 24시간 칸이면 자정을 넘겨 다음 날 새벽까지 한 신청으로 이어 담을 수 있음 (다음 날을 눌러 그 날 칸을 누름).
   신청은 1코트 1시간 칸(items = 선택 코트 × 범위 칸, court 는 0부터) 단위로 관리프로그램 /api/site 에 보냄 — api 가 비면 문자 접수.
   [결제하기] 뒤 결제 흐름이 켜져 있으면 나이스페이 결제창 → 결과는 관리프로그램이 받아 ?pay=ok|fail 로 돌려보냄 (아래 '온라인 결제').
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
  const dayAfter = s => { const d = toDate(s); d.setDate(d.getDate() + 1); return ymd(d); };
  /** 그 날 마지막 칸이 24:00 에 끝나고 다음 날이 00:00 칸으로 시작하면(배드민턴 24시간) 자정을 넘겨 다음 날까지 한 신청으로 이어 담을 수 있음
      (2026-10-19 "새벽에 하고 싶은 사람이 있을 수 있으니 다음 날을 눌러 같이 담게") — 다음 날이 예약 범위 안일 때만 */
  function joins(date) {
    const a = slotsFor(date), n = dayAfter(date), b = slotsFor(n);
    return a.length > 0 && b.length > 0 && a[a.length - 1].end === '24:00' && b[0].start === '00:00' && inRange(n);
  }
  /** 신청의 시간 줄 [{date, start, end}] — 그 날 칸 + (이어 담을 수 있으면) 다음 날 칸. sel.s~sel.e 는 이 줄의 index */
  function lineOf(date) {
    const a = slotsFor(date).map(x => ({ date, ...x }));
    if (!joins(date)) return a;
    const n = dayAfter(date);
    return a.concat(slotsFor(n).map(x => ({ date: n, ...x })));
  }
  /** 담은 신청의 칸 [{date, start, end}] · 걸친 날짜 [그 날(, 다음 날)] */
  const cellsIn = sel => lineOf(sel.date).slice(sel.s, sel.e + 1);
  const datesOf = sel => [...new Set(cellsIn(sel).map(x => x.date))];
  /** 신청 시간 줄의 lo~hi 칸이 코트 cs 모두에 비어 있는지 (자정 넘어 다음 날 칸 포함 · 아직 안 불러온 날은 비어 있다고 봄 — 신청 때 관리프로그램이 다시 확인) */
  function freeLine(date, lo, hi, cs) {
    const l = lineOf(date);
    for (let i = lo; i <= hi; i++) {
      const x = l[i];
      if (!x || isPast(x.date, x.start) || cs.some(c => booked[x.date] && booked[x.date].has(`${c}|${x.start}`))) return false;
    }
    return true;
  }

  /* ---------- 상태 ----------
     date: 보고 있는 날짜, month: 달력에서 보고 있는 달("YYYY-MM")
     sel: 담은 신청 { date, courts: [코트 index 오름차순], s, e } — s~e 는 시간 줄(lineOf(date) — 그 날 칸 + 이어 담을 수 있으면 다음 날 칸)
          index (양 끝 포함, s 는 늘 그 날 안), 없으면 null. 날짜를 바꿔 보기만 해서는 지우지 않음 (다른 날 칸을 누르면 새로 잡힘 —
          단 바로 다음 날(앞날) 칸을 같은 코트로 누르면 자정 넘어 이어 붙음)
     focus: 키보드로 움직이는 칸 { c: 열, i: 줄 } (표 안에서 Tab 이 머무는 칸 하나 — 화살표로 이동)
     scroll: 다음에 표를 그릴 때 상자 안 스크롤을 처음 위치(오늘 지금 시각 · 첫 빈 칸 · 담은 시간)로 맞출지
     lost: 그 사이 막혀서 지운 신청 { date, courts, s } — '시간 다시 고르기' 때 그 줄로 표를 보여줌 (새로 담으면 지움)
     sending: 예약 신청을 보내는 중 — 그동안 표 · 선택 해제는 바꾸지 않고 신청 버튼도 다시 켜지지 않음 */
  const state = { date: todayStr(), month: '', sel: null, focus: null, scroll: true, lost: null, sending: false };
  const hoursOf = sel => sel.e - sel.s + 1;          // 칸 수 = 시간 수 (요가 50분 칸도 1시간 단위)
  const cellsOf = sel => sel.courts.length * hoursOf(sel);
  const priceOf = sel => cellsOf(sel) * SP.price;
  function timeText(sel) { return `${rangeOnly(sel)} (${hoursOf(sel)}시간)`; }
  /** "22:00~24:00" · 자정을 넘기면 "22:00~다음 날 02:00" */
  function rangeOnly(sel) {
    const l = lineOf(sel.date), a = l[sel.s], b = l[sel.e];
    return `${a.start}~${b.date !== a.date ? '다음 날 ' : ''}${b.end}`;
  }
  /** 날짜 — 자정을 넘기면 "10월 19일(월) ~ 10월 20일(화)" */
  const dateText = sel => datesOf(sel).map(dayLabel).join(' ~ ');
  /** 안내용 "COURT 1·2 10:00~18:00 (8시간)" (요가는 코트 없이) */
  const selText = sel => `${NC > 1 ? courtText(sel.courts) + ' ' : ''}${timeText(sel)}`;
  /** "10월 16일(금) · COURT 1·2 · 10:00~18:00 (8시간)" (요가는 코트 없이) */
  const head = sel => [dayLabel(sel.date), NC > 1 ? courtText(sel.courts) : '', timeText(sel)].filter(Boolean).join(' · ');
  /** 요약 한 줄 "10월 16일(금) · COURT 1·2 · 10:00~18:00 (8시간) · 844,800원" */
  const summary = sel => `${head(sel)} · ${won(priceOf(sel))}`;
  /** 담은 신청이 아직 그대로 신청 가능한지 (그 사이 지난 시간 · 새로 들어온 예약) */
  const selOk = sel => freeLine(sel.date, sel.s, sel.e, sel.courts);

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
  const NEXT_TIP = '자정 넘어 쓰려면 다음 날 칸도 같은 코트로 이어서 고를 수 있어요';
  const GAP_WARN = '중간에 예약된 시간이 있어 이어서 선택할 수 없어요 · 누른 칸부터 새로 선택했어요';
  const LOST_WARN = '그 사이 예약된 시간이 있어요. 다시 골라주세요';
  const PAST_WARN = '선택한 시간이 지났어요. 다시 골라주세요';
  const MAX_WARN = `한 번에 최대 ${MAX}칸(코트 × 시간)까지 신청할 수 있어요. 나눠서 신청해주세요`;
  const ANCHOR_TIP = '끝 시간을 누르면 이어서 선택돼요';
  const COURT_MAX_WARN = `코트는 최대 ${COURT_MAX}면까지 함께 신청할 수 있어요`;
  const SENDING_WARN = '결제를 진행하는 중이에요. 잠시만 기다려주세요';
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
    const tv = ymd(today0()), minM = ym(today0()), maxM = ym(lastDay()), has = state.sel ? datesOf(state.sel) : [];
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const v = ymd(d), wd = d.getDay();
      const off = !inRange(v) || !slotsFor(v).length;
      const cls = [d.getMonth() !== m - 1 ? 'out' : '', wd === 0 ? 'sun' : wd === 6 ? 'sat' : '', v === state.date ? 'on' : '', has.includes(v) ? 'bk2-has' : ''].filter(Boolean).join(' ');
      cells += `<button type="button" data-date="${v}" class="${cls}"${off ? ' disabled' : ''} aria-label="${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일${off ? ' (예약 불가)' : ''}${has.includes(v) ? ' (담은 시간 있음)' : ''}" aria-pressed="${v === state.date}">
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
  /** 표의 열 — 코트마다 한 열 (코트를 모두 고르면 '전체대관') */
  const cols = () => ALL.map(c => ({ courts: [c], name: SP.courts[c] }));
  /** 보고 있는 날짜에서 본 담은 신청 — { ...sel, s, e, off } (s~e 는 이 날 칸 index: 앞날에서 자정 넘어 이어 온 신청이면 s 가 음수,
      다음 날로 넘어가면 e 가 이 날 칸 수 이상, off = 시간 줄 index − 이 날 index). 이 날에 걸친 칸이 없으면 null */
  function selHere() {
    const sel = state.sel, D = state.date;
    if (!sel) return null;
    const off = sel.date === D ? 0 : joins(sel.date) && dayAfter(sel.date) === D ? slotsFor(sel.date).length : -1;
    if (off < 0 || sel.e - off < 0 || sel.s - off >= slotsFor(D).length) return null;
    return { ...sel, s: sel.s - off, e: sel.e - off, off };
  }
  /** 선택 안 된 코트 c 를 지금 범위에 더할 수 있는지 (코트별 보기의 '+ 추가' 표시) — sel 은 담은 신청(state.sel) */
  function canAdd(sel, c) {
    return sel.courts.length < COURT_MAX && (sel.courts.length + 1) * hoursOf(sel) <= MAX && freeLine(sel.date, sel.s, sel.e, [c]);
  }
  /** 칸 모양 — cls: '' 빈 칸('선택') · off('—': 지난 시간 · 예약됨 · 레슨) · on(담김, s 시작 · e 끝) · add(선택 안 된 코트의 범위 줄 — 누르면 같은 시간으로 추가)
      · wait(예약 현황 불러오는 중) */
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
    if (!col.courts.every(c => free(D, i, c, list))) {
      return { cls: 'off', text: '—', off: true, label: `${col.name} ${t} ${isPast(D, x.start) ? '지난 시간' : '예약 마감'}` };
    }
    if (inR && canAdd(state.sel, col.courts[0])) {
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
      return { c: c >= 0 ? c : Math.max(0, cs.findIndex(col => col.courts.includes(sel.courts[0]))), i: Math.max(0, sel.s) };
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
    $('bkClear').hidden = !state.sel;
    // 다른 날에 담아 둔 시간 — 이 날 칸을 누르면 새로 잡힌다는 것(바로 다음 날 · 앞날이면 자정 넘어 이어 붙는다는 것)도 미리 알려 둠.
    // 담은 시간이 이 날 24:00 에 끝나고 다음 날로 이어 담을 수 있으면 [다음 날 보기]
    const other = state.sel && !sel;
    const near = other && (joins(state.sel.date) && dayAfter(state.sel.date) === D
      || joins(D) && dayAfter(D) === state.sel.date && state.sel.e < slotsFor(state.sel.date).length);
    const tip = sel && sel.off === 0 && sel.e === list.length - 1 && joins(D);
    $('bkElse').hidden = !other && !tip;
    if (other) {
      $('bkElse').innerHTML = `<span>담아 둔 시간 <b>${esc(head(state.sel))}</b> · ${near ? '같은 코트의 이 날 칸을 누르면 자정 넘어 이어서 담겨요' : '이 날 칸을 누르면 새로 잡혀요'}</span><button type="button" data-go>그 날 보기</button>`;
    } else if (tip) {
      $('bkElse').innerHTML = `<span>${NEXT_TIP}</span><button type="button" data-next>다음 날 보기 →</button>`;
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

  /* 칸 누름 — 결과는 sel 하나만 바꿈 (한 신청 = 이어진 범위 하나 · 같은 시간의 코트 1~3개)
     - '—' 칸은 아무 일 없음 (단, 코트별 보기에서 선택 안 된 코트의 범위 줄 '—' 칸 → 그 코트를 더할 수 없는 까닭을 안내)
     - 신청을 보내는 중이면 바꾸지 않음. 다른 날짜에 담아 둔 게 있으면 지우고 이 날짜에서 새로 시작 —
       단 담은 날의 다음 날(자정 넘김)이나 앞날의 칸을 선택된 코트 열에서 누르면 그 칸까지 이어 붙임(사이 칸이 다 비어 있어야 — 아니면 안내 후
       새로 시작). 이 날에 걸친 칸이 있으면 아래 규칙 그대로, 없는 날에서 다른 코트 열을 누르면 새로 시작
     - 담은 게 없음 → 그 열(코트 · 전체대관)의 그 칸 1칸 = 시작점
     - 선택된 열:
         첫 칸(1칸뿐인 시작점 포함) → 그 열의 코트를 뺌 (마지막 코트면 전부 해제)
         시작점(1칸)만 있을 때 다른 칸 → 시작~그 칸 (앞뒤 방향, 모든 선택 코트에 같이). 사이에 막힌 칸이 있으면 안내 후 누른 칸에서 새로 시작
         범위 안 다른 칸 → 시작~그 칸으로 줄임 (모든 선택 코트 같이) / 끝 칸 → 그대로 / 범위 밖 → 전부 지우고 그 칸에서 새로 시작
     - 코트별 보기에서 선택 안 된 코트 열의 아무 칸 → 그 코트를 '같은 시간 범위'로 추가 (범위 중 막힌 칸이 있으면 안내만).
       범위 밖 줄을 눌렀으면 표를 범위로 올려 보여주고 포커스도 그 코트의 시작 칸으로
     - 바뀐 뒤 칸 수(코트 × 시간)가 MAX 를 넘으면 안내 후 바꾸지 않음 */
  function pick(col, i) {
    const D = state.date, list = slotsFor(D);
    if (!list[i]) return;
    if (state.sending) { flashWarn(SENDING_WARN); say(SENDING_WARN); return; }
    const v = cellView(col, i, list), here = selHere();
    if (v.off) {
      if (v.cls === 'off' && here && i >= here.s && i <= here.e && !isPast(D, list[i].start)
        && !col.courts.every(c => here.courts.includes(c))) {
        const w = here.courts.length >= COURT_MAX ? COURT_MAX_WARN : busyWarn(col.courts[0], state.sel);
        flashWarn(w); say(w);
      }
      return;
    }
    let sel = state.sel, g = i, cross = false, warn = '', said = '', next, jump = false;
    // 담은 신청과 누른 칸을 한 시간 줄에 놓기: 같은 날 / 담은 날의 다음 날(자정 넘김 — g = 그 날 칸 수 + i) /
    // 담은 날의 앞날(신청이 그 날 안에 있을 때만 — 신청을 이 날 기준 줄로 옮김). 그 밖의 날이면 새로 시작
    if (sel && sel.date !== D) {
      const n0 = slotsFor(sel.date).length;
      if (joins(sel.date) && dayAfter(sel.date) === D) { g = n0 + i; cross = true; }
      else if (joins(D) && dayAfter(D) === sel.date && sel.e < n0) { sel = { ...sel, date: D, s: sel.s + list.length, e: sel.e + list.length }; cross = true; }
      else { sel = null; warn = DATE_WARN; }
    }
    const lone = () => ({ date: D, courts: col.courts.slice(), s: i, e: i });
    if (!sel) {
      next = lone(); said = `${selText(next)} 선택됨. ${ANCHOR_TIP}`;
    } else {
      const mine = col.courts.every(c => sel.courts.includes(c)), inR = g >= sel.s && g <= sel.e;
      if (mine && g === sel.s) {
        const left = sel.courts.filter(c => !col.courts.includes(c));
        next = left.length ? { ...sel, courts: left } : null;
        said = next ? `${courtLabel(col.courts)} 선택 해제. ${selText(next)} 남음` : `${selText(sel)} 선택 해제`;
      } else if (mine && (sel.s === sel.e || (cross && !inR))) {
        // 시작점만 있을 때 · 자정 넘어 다음 날(앞날) 칸 → 지금 범위에서 그 칸까지 이어서
        const lo = Math.min(sel.s, g), hi = Math.max(sel.e, g);
        if (freeLine(sel.date, lo, hi, sel.courts)) { next = { ...sel, s: lo, e: hi }; said = `${selText(next)} 선택됨`; }
        else { warn = GAP_WARN; next = lone(); said = `${selText(next)} 새로 선택됨. ${ANCHOR_TIP}`; }
      } else if (mine && inR) {
        if (g === sel.e) { next = state.sel; said = `끝 칸이라 그대로예요. ${selText(sel)}`; }
        else { next = { ...sel, e: g }; said = `${selText(next)}으로 줄었어요`; }
      } else if (mine) {
        next = lone(); said = `이전 선택 해제. ${selText(next)} 선택됨. ${ANCHOR_TIP}`;
      } else {
        const c = col.courts[0];
        if (cross && !here) { warn = DATE_WARN; next = lone(); said = `${selText(next)} 새로 선택됨. ${ANCHOR_TIP}`; }   // 이 날엔 담은 시간이 없음
        else if (sel.courts.length >= COURT_MAX) { warn = COURT_MAX_WARN; next = state.sel; }
        else if (!freeLine(sel.date, sel.s, sel.e, [c])) { warn = busyWarn(c, sel); next = state.sel; }
        else {
          next = { ...sel, courts: sel.courts.concat(c).sort((a, b) => a - b) }; said = `${SP.courts[c]} 추가. ${selText(next)}`;
          jump = !inR;
        }
      }
    }
    if (next && next !== state.sel && cellsOf(next) > MAX) {   // 넘으면 하나도 안 바꿈
      flashWarn(MAX_WARN); say(MAX_WARN);
      return;
    }
    // 시작이 다음 날로 넘어간 범위(앞 칸을 줄여 다음 날만 남음)는 그 날 기준 줄로
    if (next && next !== state.sel && next.s >= slotsFor(next.date).length) {
      const n0 = slotsFor(next.date).length;
      next = { ...next, date: dayAfter(next.date), s: next.s - n0, e: next.e - n0 };
    }
    if (next !== state.sel) clearDraft();   // 끝 칸을 다시 누른 것처럼 그대로면 문자 신청 초안도 그대로
    state.sel = next; state.lost = null;
    // 범위 밖 줄을 눌러 코트를 더했으면 바뀐 범위가 화면 밖 — 표 상자를 범위 시작으로 옮기고 포커스도 그 코트의 시작 칸으로
    if (jump && state.focus) {
      const h = selHere();
      state.focus = { c: state.focus.c, i: Math.max(0, h ? h.s : 0) }; state.scroll = true;
    }
    update();
    if (warn) flashWarn(warn); else hideWarn();
    say([warn, said].filter(Boolean).join('. '));
  }

  /** 담은 신청이 그 사이 막혔으면(지난 시간 · 새 예약) 지우고 안내. 그대로면 true */
  function keepSel() {
    const sel = state.sel;
    if (!sel || selOk(sel)) return true;
    const past = cellsIn(sel).some(x => isPast(x.date, x.start));
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
    const days = datesOf(sel);
    if (sent) days.forEach(d => { delete booked[d]; });
    update();
    flashWarn(text);
    if (sent) days.forEach(load); else say(text);
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
          <div><dt>날짜</dt><dd>${esc(dateText(sel))}</dd></div>
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
  $('bkElse').addEventListener('click', e => {
    if (e.target.closest('[data-go]')) backToGrid();
    else if (e.target.closest('[data-next]') && joins(state.date)) goDate(dayAfter(state.date));
  });
  $('bkClear').addEventListener('click', () => {
    if (!state.sel) return;
    if (state.sending) { flashWarn(SENDING_WARN); say(SENDING_WARN); return; }
    const t = `${selText(state.sel)} 선택 해제`;
    state.sel = null; clearDraft(); update(); hideWarn();
    const f = state.focus; if (f) focusCell(f.c, f.i, true);   // 버튼이 사라지므로 표로 포커스
    say(t);
  });

  /* ---------- 신청 폼 ---------- */
  const form = $('bkForm');
  // 대관 환불 규정 (2026-10-18 — 관리프로그램 > 안내문 '대관 환불 규정', assets/pay-ui.js). 체크해야 [결제하기]가 켜짐 · 문자 접수(api 없음)엔 없음
  const terms = CFG.api && $('bkTerms') && window.PAYUI
    ? window.PAYUI.terms($('bkTerms'), { api: CFG.api, key: 'refund_rental', phone: SP.phone, onChange: () => validate() }) : null;
  /* 결제 대기 5분 경고 — [결제하기] 버튼 위 #bkHold (2026-10-18 센터 "빨간 글자로 경고문구, 시간 줄어들게").
     관리프로그램은 신청(book)을 받는 순간 그 시간을 잡아 두고 PAY_HOLD_MIN(5)분 안에 결제가 안 끝나면 자동 취소 + 칸 해제(pay_expire_due).
     결제창을 열기 전엔 고정 경고, 결제창이 열려 있는 동안(PC — 휴대폰은 결제 화면으로 넘어감)은 서버 expiresAt 기준 남은 시간을 1초마다 */
  const HOLD_MIN = CFG.payHoldMin || 5;   // 관리프로그램 PAY_HOLD_MIN 과 같게 (2026-10-18 15분 → 5분)
  const HOLD_NOTE = `결제창이 열리면 ${HOLD_MIN}분 안에 결제를 마쳐 주세요 — 시간이 지나면 신청이 자동 취소되고 고른 시간이 풀려요.`;
  let holdTimer = 0;
  function holdNote(html) {
    const el = $('bkHold');
    if (!el) return;
    el.innerHTML = html || '';
    el.hidden = !html;
  }
  function holdCountdown(until) {
    clearInterval(holdTimer);
    const tick = () => {
      const left = Math.max(0, until - Date.now());
      const m = Math.floor(left / 60e3), s = Math.floor(left / 1e3) % 60;
      holdNote(`⏱ 남은 결제 시간 <b>${m}:${String(s).padStart(2, '0')}</b> — 시간이 지나면 신청이 자동 취소돼요.`);
      if (!left) { clearInterval(holdTimer); holdTimer = 0; }
    };
    tick();
    holdTimer = setInterval(tick, 1000);
  }
  function holdReset() { clearInterval(holdTimer); holdTimer = 0; holdNote(CFG.api ? esc(HOLD_NOTE) : ''); }
  holdReset();
  function validate() {
    const ok = !!state.sel && cellsOf(state.sel) <= MAX && form.name.value.trim() && /^[0-9\-+ ]{9,}$/.test(form.phone.value.trim()) && form.agree.checked
      && (!terms || terms.ok());
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
    const sel = state.sel;
    const items = sel.courts.flatMap(c => cellsIn(sel).map(x => ({ date: x.date, court: c, start: x.start })));   // 자정을 넘기면 다음 날 칸도

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

    const name = form.name.value.trim(), phone = form.phone.value.trim();
    // 결제 전 확인창 (2026-10-18) — 공간 · 날짜 · 코트 · 시간 · 금액 · 이름 · 연락처. 취소하면 아무것도 안 보냄(칸도 안 잡음)
    if (window.PAYUI) {
      const yes = await window.PAYUI.confirm({
        title: '예약·결제 전에 확인해 주세요',
        rows: [['공간', SP.name], ['날짜', dateText(sel)], NC > 1 ? ['코트', courtText(sel.courts)] : null, ['시간', timeText(sel)],
          ['이름', name], ['연락처', phone]],
        amount: priceOf(sel),
        note: isPayTest() ? '시험 주소예요 — 테스트 결제창이 열려요.' : '카드 결제가 끝나면 바로 확정되고, 입력하신 번호로 확정 문자가 가요.',
      });
      if (!yes) return;
      if (state.sending || state.sel !== sel || !validate() || !keepSel()) return;   // 확인창을 보는 사이 바뀐 것 (다른 칸 · 그 사이 예약됨)
    }
    const btn = $('bkSubmit');
    state.sending = true;
    btn.disabled = true; btn.textContent = '결제 준비 중…';
    clearDraft();   // 지난 결제 실패 안내 등은 내림 (새 결과가 다시 씀)
    let after = null;   // 끝난 뒤 할 일 (선택 지우기 등) — 버튼 문구를 되돌린 다음에. 결과는 보낸 신청(sel) 기준
    try {
      if (held) await release(held);   // 지난번에 못 푼 결제 대기 칸부터 (같은 시간을 다시 고르면 내 신청과 겹쳐 '그 사이 예약됨'이 되지 않게)
      const r = await post({ action: 'book', space, items, name, phone, people: form.people.value, memo: form.memo.value.trim() });
      if (r.ok) {
        // 서버는 신청을 받으면서 그 시간을 이미 잡아 둔다(확인 전) — 결제하는 동안 다른 사람이 같은 칸을 못 잡음.
        // 결제 흐름이 켜져 있으면 결제창으로 (끝은 결과 화면 이동 또는 payStop — 그때까지 선택 · 입력은 그대로)
        const p = await prepare(r.id, phone);
        if (p && p.enabled) {
          openPay(p, { id: r.id, name, phone, dates: datesOf(sel),
            sum: { where: SP.name + (NC > 1 ? ` · ${courtText(sel.courts)}` : ''), when: dateText(sel), time: timeText(sel), amount: p.amount } });
          return;
        }
        const err = p && p.error;
        let rr = '';
        // 결제 대기 시간이 (거의) 지난 신청(같은 칸을 조금 전에 신청해 둔 것 등) — 잡아 둔 칸을 바로 풀어 다시 결제할 수 있게
        if (err === 'expired') rr = await release({ id: r.id, phone });
        if (rr === 'ok') {
          // 풀었음 — 고른 시간 · 입력은 그대로 (다시 [결제하기] 하면 새 신청 · 새 결제 대기 5분)
          const days = datesOf(sel);
          for (const d of days) { await loading[d]; delete booked[d]; }
          after = () => { days.forEach(load); showMsg('결제 시간이 지났어요 — 다시 결제하거나 시간을 다시 골라주세요', 'err'); };
        } else {
          // 꺼져 있으면 지금처럼 신청만 저장 — '신청 접수' 안내 없이 선택 · 입력을 비우고 표를 새로 불러옴 (관리자가 확인 후 연락).
          // 결제 준비가 안 된 이유가 있으면(이미 결제됨 · 승인 중 · 이미 처리 중 · 연결 실패) 그 상황대로 알림
          if (state.sel === sel) state.sel = null;
          state.lost = null; form.reset();
          Object.keys(booked).forEach(k => delete booked[k]);
          after = () => {
            update(); load(state.date);
            if (err === 'already_paid') showMsg(paidMsg(r.id, p.test), 'ok');
            else if (err === 'in_progress') showMsg(esc(PAY_UNKNOWN), 'info');
            else if (err) showMsg(`신청(${esc(r.id)})은 접수됐어요 — 이미 확인 중인 신청이라 결제는 확인 후 연락드릴 때 안내할게요. 문의 ${SP.phone}`, 'info');
            else if (!p) showMsg(`결제창을 열지 못했어요. 신청(${esc(r.id)})은 접수됐으니 확인 후 연락드릴게요. 문의 ${SP.phone}`, 'err');
          };
        }
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
      showMsg(`결제 준비 중 오류가 발생했습니다. 전화(${SP.phone})로 문의해주세요.`, 'err');
    }
    endSend(after);
  });
  /** 보내기(신청 · 결제) 끝 — 버튼을 되돌리고 after(선택 지우기 · 안내 등)를 한 뒤,
      버튼이 꺼지며(또는 결제창이 닫히며) 키보드 포커스가 빠졌으면(body) 되살림 — '시간 다시 고르기' · 다시 켜진 신청 버튼 · 결과 안내 문단 */
  function endSend(after) {
    const btn = $('bkSubmit');
    state.sending = false;
    btn.textContent = '결제하기';
    const a = document.activeElement, dropped = !a || a === document.body || a === btn;
    validate();
    const m = $('bkMsg');
    if (after) after();
    if (dropped) {
      const edit = m.querySelector('[data-edit]');
      if (edit) edit.focus({ preventScroll: true });
      else if (!btn.disabled) btn.focus({ preventScroll: true });
      else if (m.textContent.trim()) { m.tabIndex = -1; m.focus({ preventScroll: true }); }
    }
  }
  $('bkMsg').addEventListener('click', e => { if (e.target.closest('[data-edit]')) backToGrid(); });

  /* ---------- 온라인 결제 (나이스페이 결제창, 관리프로그램 docs/site-api.md 4~6절) ----------
     [결제하기] → api 'book'(칸 잡힘 · 확인 전) → api 'pay_prepare'(결제 흐름이 켜졌는지 · 금액 · 주문번호 — 전부 서버가 정함, test = 주소에 ?paytest=1)
     → 켜져 있으면 나이스페이 JS SDK 를 그때 불러와 AUTHNICE.requestPay → 인증 결과는 나이스페이가 관리프로그램 returnUrl 로 보내고,
       관리프로그램이 승인한 뒤 이 화면으로 돌려보냄 — ?pay=ok|fail&no=신청번호(&msg=짧은 안내)(&paytest=1)#rental (payResult).
     결제창 닫기 · 오류(fnError) · 결제창을 못 엶 · 결제 화면에서 뒤로 옴(같은 화면이 되살아남) · 결제 대기 시간 초과 → api 'pay_cancel' 로
     잡아 둔 칸을 바로 풀고, 고른 시간 · 입력은 그대로 둬 다시 결제하거나 시간을 바꿀 수 있게 (payStop — 폼 아래 안내).
     화면을 새로 연 경우(휴대폰 결제 화면에서 뒤로 와 새로 열림 · ?pay=fail 결과)는 sessionStorage 기록으로 칸을 풀고 대관 맨 위 안내 (resumePay).
     샌드박스(테스트) 결제는 관리프로그램이 신청을 확정하지 않는다 — '테스트 결제 완료(확정 안 됨)'로 안내.
     꺼져 있으면(키 없음 · 샌드박스인데 ?paytest=1 없음) 지금처럼 신청만 저장. 시크릿 키 · 금액 계산은 이 파일에 없음 */
  const PAY_KEY = 'bkPay';   // sessionStorage — 결제창으로 넘어간 신청 { id, phone, orderId, space, at } (휴대폰 결제 화면에서 뒤로 와 새로 열려도 칸을 풀려고)
  // ?msg= 는 누구나 주소에 적을 수 있어서 관리프로그램 PAY_MSG 와 같은 문구만 보여준다 (그 밖의 글은 버림)
  const PAY_MSGS = ['결제가 취소됐거나 인증되지 않았어요.', '이미 끝났거나 취소된 결제예요.', '신청 내용이 바뀌어 결제하지 않았어요.',
    '카드 승인이 되지 않았어요.', '결제 승인 중 연결이 끊겨 결제를 취소했어요.', '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.'];
  const payMsgOk = m => PAY_MSGS.includes(m) || /^결제 시간\(\d{1,3}분\)이 지났어요\.$/.test(m);
  const PAY_UNKNOWN = '결제 결과를 확인하고 있어요. 결과는 문자로 알려드릴게요.';   // 관리프로그램 PAY_MSG.unknown — 실패가 아니라 결과 대기
  const PAY_FAIL = '결제가 완료되지 않았어요';
  // 샌드박스(테스트) 결제는 돈이 오가지 않아 관리프로그램이 신청을 확정하지 않는다 (확인 전 그대로 — 관리프로그램 pay_rental_paid)
  const PAY_TEST_NOTE = '샌드박스 시험 결제예요 — 실제 결제가 아니라 예약은 확정되지 않았어요 (확인 전).';
  const isPayTest = () => new URLSearchParams(location.search).get('paytest') === '1';
  let pay = null;    // 결제창이 열린 신청 { id, phone, orderId, dates(신청이 걸친 날짜), test, timer, closing }
  let held = null;   // 풀지 못한(연결 실패) 결제 대기 신청 { id, phone, orderId } — 다음 [결제하기] 전에 다시 풂

  /** 관리프로그램 /api/site POST → 응답 JSON (연결 실패 · JSON 아님은 throw — 오류 응답 4xx 도 JSON 이라 그대로 읽음) */
  async function post(body) {
    const res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return res.json();
  }
  function stash(v) {
    try { if (v) sessionStorage.setItem(PAY_KEY, JSON.stringify(v)); else sessionStorage.removeItem(PAY_KEY); } catch (e) { /* 못 써도 결제는 그대로 — 칸은 5분 뒤 서버가 풂 */ }
  }
  function stashed() {
    try { const v = JSON.parse(sessionStorage.getItem(PAY_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
  }
  /** UTF-8 n바이트 안으로 자름 (나이스페이 길이 규칙이 byte — 한글 10자 = 30바이트) */
  function cutBytes(s, n) {
    let out = '', len = 0;
    for (const ch of String(s)) {
      const p = ch.codePointAt(0), b = p < 0x80 ? 1 : p < 0x800 ? 2 : p < 0x10000 ? 3 : 4;
      if (len + b > n) break;
      out += ch; len += b;
    }
    return out;
  }

  /** 결제창에 넘길 연락처 — '-' 없이 숫자만, +82 10-… · 82 10-… 은 010… (관리프로그램 site_phone 과 같게) */
  function telDigits(t) {
    let d = String(t).replace(/\D/g, '');
    if (/^\s*\+82/.test(t) || (d.startsWith('82') && d.length >= 11)) d = '0' + d.slice(2).replace(/^0+/, '');
    return d.slice(0, 20);
  }
  /** 결제 준비 (api pay_prepare) → 응답 { enabled, … } / 결제창을 열 수 없는 신청이면 { error, test } / 연결 실패 · 그 밖이면 null.
      error: already_paid(이미 결제됨 — test = 테스트 결제) · in_progress(승인 중) · expired(결제 대기 시간이 지남) · not_payable(이미 처리 중인 신청).
      결제 기능 전의 관리프로그램은 모르는 action 에 bad_request — 결제 흐름이 없는 것과 같게(지금 동작 그대로) */
  const PREP_ERRORS = ['already_paid', 'in_progress', 'expired', 'not_payable'];
  async function prepare(id, phone) {
    try {
      const p = await post({ action: 'pay_prepare', kind: 'rental', id, phone, test: isPayTest(), agreeRefund: !!(terms && terms.ok()) });
      if (p && p.ok) return p;
      if (p && p.error === 'bad_request') return { enabled: false };
      return p && PREP_ERRORS.includes(p.error) ? { error: p.error, test: p.test === true } : null;
    } catch (e) { return null; }
  }
  /** '결제 완료' 안내 (폼 아래) — 테스트 결제(샌드박스)는 신청이 확정되지 않음 */
  function paidMsg(id, test) {
    return test ? `<b>테스트 결제 완료</b> — 신청번호 ${esc(id)}<br><small>${PAY_TEST_NOTE}</small>`
      : `<b>결제 완료 · 예약 확정</b> — 신청번호 ${esc(id)}`;
  }

  let sdk = null;   // 결제창 SDK 불러오기 (Promise, 한 번만 — 실패하면 다음에 다시)
  function loadSdk(mode) {
    if (window.AUTHNICE) return Promise.resolve();
    const src = (CFG.paySdk || {})[mode];
    if (!src) return Promise.reject(new Error('no_sdk'));
    if (!sdk) {
      sdk = new Promise((ok, no) => {
        const s = document.createElement('script');
        const t = setTimeout(() => no(new Error('sdk_timeout')), 20000);
        s.src = src; s.async = true;
        s.onload = () => { clearTimeout(t); if (window.AUTHNICE) ok(); else no(new Error('no_authnice')); };
        s.onerror = () => { clearTimeout(t); s.remove(); no(new Error('sdk_load')); };
        document.head.appendChild(s);
      }).catch(err => { sdk = null; throw err; });
    }
    return sdk;
  }

  /** 결제창 열기 — p: pay_prepare 응답(서버가 정한 clientId · orderId · amount · goodsName · returnUrl), o: { id(신청번호), name, phone, dates } */
  async function openPay(p, o) {
    const test = p.mode !== 'live';
    const cur = pay = { id: o.id, phone: o.phone, orderId: p.orderId, dates: o.dates, test, timer: 0, closing: false };
    stash({ id: o.id, phone: o.phone, orderId: p.orderId, space, test, at: Date.now(), sum: o.sum || null });   // sum = 결제 완료 화면 '무엇을 · 얼마에'
    const btn = $('bkSubmit');
    btn.textContent = '결제창 여는 중…';
    try { await loadSdk(p.mode); } catch (e) { payStop(cur, 'sdk'); return; }
    if (pay !== cur) return;   // 그 사이 끝남 (뒤로 오기 등)
    // 결제 대기 시간(서버 expiresAt, KST)이 지나면 서버가 칸을 푼다 — 결제창이 결과 없이 사라졌을 때 화면도 되돌리게.
    // 기기 시계가 크게 어긋나 있으면 HOLD_MIN 분으로
    const left = Date.parse(String(p.expiresAt) + '+09:00') - Date.now();
    const until = Date.now() + (left > 30e3 && left < (HOLD_MIN + 1) * 60e3 ? left : HOLD_MIN * 60e3);
    cur.timer = setTimeout(() => payStop(cur, 'timeout'), until - Date.now() + 30e3);
    holdCountdown(until);   // 버튼 위 빨간 남은 시간 — 결제창이 끝나면(payStop) 고정 경고로 되돌림
    btn.textContent = '결제 진행 중…';
    try {
      window.AUTHNICE.requestPay({
        clientId: p.clientId, method: CFG.payMethod || 'card', orderId: p.orderId, amount: p.amount,
        goodsName: p.goodsName, returnUrl: p.returnUrl,
        buyerName: cutBytes(o.name, 30), buyerTel: telDigits(o.phone),
        fnError: res => { payStop(cur, 'error', res); },
      });
    } catch (e) { payStop(cur, 'error'); }
  }

  /** 잡아 둔 칸 풀기 (api pay_cancel) → 'ok'(풀었음) / 'done'(풀 주문이 없음 — 이미 끝났거나 서버가 풂) / 'paid'(그 사이 결제됨) /
      'busy'(승인 중) / 'gone'(신청을 못 찾음) / 'net'(연결 실패 · 그 밖 — held 에 남겨 다음 [결제하기] 전에 다시) */
  async function release(o) {
    const h = { id: o.id, phone: o.phone, orderId: o.orderId };
    try {
      const r = await post({ action: 'pay_cancel', kind: 'rental', ...h });
      held = null;
      if (r.ok) return r.released ? 'ok' : 'done';
      if (r.error === 'already_paid') return 'paid';
      if (r.error === 'in_progress') return 'busy';
      if (r.error === 'not_found') return 'gone';
    } catch (e) { /* 아래 */ }
    held = h;
    return 'net';
  }

  /** 결제창이 결과 없이 끝남 — 칸을 풀고 안내(폼 아래 #bkMsg). 고른 시간 · 입력은 그대로 둬 다시 결제하거나 시간을 바꿀 수 있게.
      why: error(결제창 닫기 · 오류 fnError) / sdk(결제창을 못 엶) / timeout(결제 대기 시간 초과) / back(결제 화면에서 뒤로 옴) */
  async function payStop(cur, why, res) {
    if (!cur || pay !== cur || cur.closing) return;
    cur.closing = true;
    clearTimeout(cur.timer);
    const r = await release(cur);
    const freed = r === 'ok' || r === 'done';   // 풀었거나 이미 풀린 주문
    pay = null; stash(null);
    holdReset();
    // 풀린 칸을 다시 불러오게 — 못 풀었으면(연결 실패) 그대로 둠: 내 신청이 잡은 칸이 '그 사이 예약됨'으로 보여 선택이 지워지지 않게
    if (freed) for (const d of cur.dates) { await loading[d]; delete booked[d]; }
    let after;
    if (r === 'paid' || r === 'busy') {
      // 그 사이 결제가 끝났거나 승인 중 — 같은 시간을 다시 잡지 않게 선택 · 입력을 비움
      state.sel = null; state.lost = null; form.reset();
      Object.keys(booked).forEach(k => delete booked[k]);
      after = () => {
        update(); load(state.date);
        showMsg(r === 'paid' ? paidMsg(cur.id, cur.test) : esc(PAY_UNKNOWN), r === 'paid' ? 'ok' : 'info');
      };
    } else {
      const head = why === 'sdk' ? '결제창을 열지 못했어요. 잠시 뒤 다시 시도해주세요'
        : why === 'timeout' ? '결제 시간이 지났어요 — 다시 결제하거나 시간을 다시 골라주세요'
        : `${PAY_FAIL} — 다시 결제하거나 시간을 다시 골라주세요`;
      const sub = why === 'error' && res && typeof res.msg === 'string' ? res.msg.trim().slice(0, 100) : '';   // 나이스페이 SDK 의 고객용 문구
      after = () => {
        if (freed) cur.dates.forEach(load);
        showMsg(`${esc(head)}${sub ? `<br><small>${esc(sub)}</small>` : ''}`, 'err');
      };
    }
    endSend(after);
  }
  // 휴대폰 결제 화면에서 뒤로 와 이 화면이 그대로(bfcache) 되살아나면 — 결과 없이 돌아온 것
  addEventListener('pageshow', e => { if (e.persisted && pay) payStop(pay, 'back'); });

  /** 결제 결과 안내 — 대관 화면 맨 위(#bkResult). kind: ok / fail / wait(결과 확인 중), test: 테스트 결제(샌드박스 — 신청은 확정 안 됨).
      화면 안으로 스크롤하고 포커스 */
  function payBanner(kind, no, msg, test, s) {
    const el = $('bkResult');
    if (!el) return;
    const num = no ? ` — 신청번호 <span class="bk2-no">${esc(no)}</span>` : '';
    const doneView = kind === 'ok' && !test && window.PAYUI;   // 결제 완료 화면 (2026-10-18 — 무엇을 · 얼마에 · 다음 할 일)
    el.className = 'bk2-result ' + (doneView ? 'done' : kind === 'ok' ? 'ok' : kind === 'wait' ? 'info' : 'err');
    el.innerHTML = doneView ? paidView(no, s)
      : kind === 'ok' ? (test ? `<b>테스트 결제 완료</b>${num}<small>${PAY_TEST_NOTE}</small>` : `<b>결제 완료 · 예약 확정</b>${num}`)
      : kind === 'wait' ? `<b>결제 결과를 확인하고 있어요</b>${num}<small>결과는 문자로 알려드릴게요.</small>`
      : `<b>${PAY_FAIL}</b> — 시간을 다시 골라주세요${msg ? `<small>${esc(msg)}</small>` : ''}`;
    el.hidden = false;
    el.tabIndex = -1;   // 화면낭독기는 포커스를 받은 안내를 읽음 (#bkLive 로 또 읽지 않게)
    // 안내는 #rental 맨 위. 페이지를 다 읽은 뒤(브라우저의 # 이동 · 뒤로 가기 스크롤 복원이 끝난 뒤) 안내를 위 메뉴 · 탭 바로 아래로
    // (scroll-margin-top — booking.css) — 다 읽기 전에 손님이 스크롤했으면 그대로
    let moved = false;
    const mark = () => { moved = true; };
    addEventListener('wheel', mark, { once: true, passive: true });
    addEventListener('touchmove', mark, { once: true, passive: true });
    const show = () => requestAnimationFrame(() => {
      if (!moved) el.scrollIntoView({ block: 'start', behavior: 'instant' });
      el.focus({ preventScroll: true });
    });
    if (document.readyState === 'complete') show(); else addEventListener('load', show, { once: true });
  }
  /** 대관 결제 완료 화면 — s: 결제창으로 넘어갈 때 남긴 기록(bkPay — 같은 신청이면 공간 · 날짜 · 시간 · 금액), 없으면 신청번호만 */
  function paidView(no, s) {
    const sum = s && s.sum;
    const rows = sum ? [['예약', `${sum.where}\n${sum.when} · ${sum.time}`], ['결제 금액', won(sum.amount)]] : [];
    if (no) rows.push(['신청번호', no]);
    const to = s && s.phone ? `입력하신 번호(${window.PAYUI.maskPhone(s.phone)})` : '입력하신 번호';
    return window.PAYUI.done({ title: '결제 완료 · 예약 확정', rows, steps: [
      `${to}로 예약 확정 문자를 보내드려요.`,
      '예약한 시간에 맞춰 오시면 돼요. 이용 시간이 지나면 다음 예약을 위해 정리해 주세요.',
      `취소·변경은 ${SP.phone}로 연락 주세요 — 결제 전에 확인한 대관 환불 규정대로 처리해 드려요.`,
    ] });
  }
  /** 결제를 마치고 돌아온 주소(?pay=ok|fail&no=&msg=) → 안내 후 주소에서 pay · no · msg 를 뗌 (paytest · #rental 은 그대로).
      → { kind: ok | wait | fail, no } 또는 null(결과 주소 아님). 관리프로그램은 테스트(샌드박스) 주문에만 paytest=1 을 붙여 돌려보낸다 */
  function payResult() {
    const q = new URLSearchParams(location.search), kind = q.get('pay');
    if (kind !== 'ok' && kind !== 'fail') return null;
    const no = /^TS\d{6}-\d{3,6}$/.test(q.get('no') || '') ? q.get('no') : '';
    const msg = (q.get('msg') || '').trim();
    ['pay', 'no', 'msg'].forEach(k => q.delete(k));
    const qs = q.toString();
    history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    const res = { kind: kind === 'ok' ? 'ok' : msg === PAY_UNKNOWN ? 'wait' : 'fail', no };
    const s = stashed();                          // resumePay 가 지우기 전에 — 같은 신청이면 완료 화면에 예약 내용
    if (res.kind === 'ok') payBanner('ok', no, '', isPayTest(), s && s.id === no && s.space === space ? s : null);
    else if (res.kind === 'wait') payBanner('wait', no);
    else payBanner('fail', no, payMsgOk(msg) ? msg : '');
    return res;
  }
  /** 결제창으로 넘어갈 때 남긴 기록(bkPay)으로 잡아 둔 칸 정리 — 결과 없이 이 화면을 새로 열었거나(휴대폰 결제 화면에서 뒤로 · 새로고침)
      '결제가 완료되지 않았어요'(?pay=fail)로 돌아왔으면 pay_cancel 로 칸을 푼다. 관리프로그램이 주문을 닫지 않고 fail 로 보내는 경우
      (인증 결과 서명이 맞지 않음 · 결과 요청이 너무 많음 등)에도 고른 시간이 5분 동안 '예약 마감'으로 남지 않게 —
      서버는 결제 대기 주문만 닫으므로 이미 결제 · 승인 중이면 그대로(paid · busy). res: payResult() */
  async function resumePay(res) {
    const s = stashed();
    if (!s) return;
    stash(null);
    if (res && res.kind !== 'fail') return;   // 결제 완료 · 결과 확인 중 — 서버가 처리
    if (s.space !== space || typeof s.id !== 'string' || !(Date.now() - s.at < 20 * 60e3)) return;   // 다른 공간 · 오래된 기록 — 서버가 5분 뒤 풂
    if (res && res.no && res.no !== s.id) return;   // 다른 신청의 결과
    const r = await release(s);
    if (r === 'paid') payBanner('ok', s.id, '', s.test === true, s);
    else if (r === 'busy') payBanner('wait', s.id);
    else if (!res) payBanner('fail', '');
    if (r === 'ok' || r === 'done') { await loading[state.date]; delete booked[state.date]; load(state.date); }   // 풀린 칸을 다시 불러옴 (처음 조회가 끝난 뒤)
  }

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
      if (state.sel && datesOf(state.sel).includes(date) && !keepSel()) return;   // 담은 시간이 그 사이 막혔으면 지우고 다시 그림
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
  resumePay(payResult());   // 결제를 마치고(?pay=) · 결과 없이(뒤로) 돌아온 경우
})();
