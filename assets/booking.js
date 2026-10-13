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
  const dLabel = s => { const d = toDate(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const MAX = CFG.maxItems || 72;   // 한 번에 신청할 수 있는 최대 시간 수 (Code.gs MAX_ITEMS 와 동일)
  const MAX_COURTS = CFG.maxCourts || 3;   // 한 번에 같이 고를 수 있는 코트 수 (공간 코트 수보다 많으면 그 수까지)
  // month: 달력에서 보고 있는 달 ("YYYY-MM") — ensureDate() 가 선택 날짜에 맞춰 둠
  // courts: 지금 고른 코트 index 들(오름차순, 최소 1개) — 시간 버튼은 이 코트들 기준으로 표시·선택
  // sel: "날짜|코트|시작" -> 칸 (1코트 1시간 = 1칸, 신청·금액 단위)
  // anchor: 이어서 선택의 시작점 {date, start, end} 또는 null — 빈 시간을 누르면 생기고, 끝 시간을 누르면 그 사이를 한 번에 담고 해제
  const state = { space: root.querySelector('.bk-tab.on').dataset.space, date: ymd(new Date()), month: '', courts: [0], sel: new Map(), anchor: null };
  const booked = {};   // "space|date" -> Set("court|start")

  /** 그 날짜에 예약 가능한 시간 칸 [{start, end}] */
  function slotsFor(space, date) {
    return (CFG.spaces[space].slots[toDate(date).getDay()] || []).map(s => { const [start, end] = s.split('-'); return { start, end }; });
  }
  const tLabel = x => `${x.start}~${x.end}`;
  /** 코트 이름 묶음 — ['코트 1','코트 3'] → "코트 1·3" (이름이 "앞부분 + 숫자" 꼴이 아니면 쉼표로 나열) */
  function courtLabel(sp, cs) {
    const m = cs.map(c => /^(.*?)\s*(\d+)$/.exec(sp.courts[c]));
    return m.every(x => x && x[1] === m[0][1]) ? `${m[0][1]} ${m.map(x => x[2]).join('·')}`.trim() : cs.map(c => sp.courts[c]).join(', ');
  }
  const courtMax = sp => Math.min(MAX_COURTS, sp.courts.length);
  /** 한 번에 신청 가능한 최대 칸 안내 — 코트가 여럿이면 코트별 시간을 다 더한 수 */
  const maxText = (max, sp) => `한 번에 최대 ${max}시간${sp.courts.length > 1 ? '(코트별 시간 합계)' : ''}까지 신청할 수 있습니다. 나눠서 신청해주세요.`;

  /* ---------- calendar (월 달력 날짜 선택) ----------
     예약 가능 범위: 오늘 ~ 오늘 + CFG.days - 1 (약 2달). 범위가 걸친 달 사이만 ‹ › 로 이동.
     지난 날 · 범위 밖 · 그 공간에 대관 칸이 없는 요일(요가센터 주말)은 disabled. */
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const lastDay = () => { const d = today0(); d.setDate(d.getDate() + CFG.days - 1); return d; };
  const ym = d => ymd(d).slice(0, 7);                                        // "YYYY-MM"
  const inRange = v => v >= ymd(today0()) && v <= ymd(lastDay());            // "YYYY-MM-DD" 문자열 비교
  const selLabel = s => { const d = toDate(s); return `${d.getMonth() + 1}. ${d.getDate()}. (${WD[d.getDay()]})`; };

  function renderCal() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());        // 그 주 일요일부터 6주
    const tv = ymd(today0()), minM = ym(today0()), maxM = ym(lastDay());
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const v = ymd(d), wd = d.getDay();
      const off = !inRange(v) || !slotsFor(state.space, v).length;
      const cls = [d.getMonth() !== m - 1 ? 'out' : '', wd === 0 ? 'sun' : wd === 6 ? 'sat' : '', v === state.date ? 'on' : ''].filter(Boolean).join(' ');
      cells += `<button type="button" data-date="${v}" class="${cls}"${off ? ' disabled' : ''} aria-label="${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일${off ? ' (예약 불가)' : ''}" aria-pressed="${v === state.date}">
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
  /** 선택된 날짜가 이 공간에서 예약 불가(칸 없음 · 범위 밖)면 가장 가까운 가능한 날짜로 이동하고, 달력 월을 선택 날짜에 맞춤 */
  function ensureDate() {
    if (!inRange(state.date) || !slotsFor(state.space, state.date).length) {
      for (let i = 0; i < CFG.days; i++) {
        const d = today0(); d.setDate(d.getDate() + i);
        if (slotsFor(state.space, ymd(d)).length) { state.date = ymd(d); break; }
      }
    }
    state.month = state.date.slice(0, 7);
  }
  $('bkCal').addEventListener('click', e => {
    const nav = e.target.closest('button[data-nav]');
    if (nav) {
      if (nav.disabled) return;
      const [y, m] = state.month.split('-').map(Number);
      const next = ym(new Date(y, m - 1 + Number(nav.dataset.nav), 1));
      if (next < ym(today0()) || next > ym(lastDay())) return;   // 오늘이 속한 달 ~ 범위 마지막 달 사이만
      state.month = next;
      renderCal();
      return;
    }
    const b = e.target.closest('button[data-date]'); if (!b || b.disabled) return;
    if (b.dataset.date !== state.date) state.anchor = null;   // 시작점은 그 날짜 안에서만
    state.date = b.dataset.date;
    state.month = state.date.slice(0, 7);   // 전월/익월 날짜를 고르면 그 달로 이동
    renderCal(); renderSlots();
    loadBooked().then(renderSlots);
  });

  /* ---------- courts (여러 코트 같이 선택 — 최소 1개, 최대 courtMax) ---------- */
  /** 화면낭독기 안내 — 화면에 안 보이는 role=status 한 칸에 방금 일어난 일을 한 줄로 (담김 · 빠짐 · 경고).
      제목 옆 안내 칸(#bkCourtNote · #bkTimeNote)은 aria-live 가 아님 — 시작점 안내로 바뀌거나 기본 문구로 되돌아갈 때마다 다시 읽히지 않게 */
  const sr = document.createElement('p');
  sr.className = 'bk-sr'; sr.setAttribute('role', 'status');
  root.appendChild(sr);
  const say = t => { sr.textContent = sr.textContent === t ? t + '\u00a0' : t; };   // 같은 문구가 이어져도 다시 읽히게 끝 공백을 붙였다 뗐다 함
  /** 단계 제목 옆 작은 안내(<small>)를 잠깐 경고 문구로 바꿨다가 되돌림 — 휴대폰에선 아래 bkMsg 가 화면 밖이라 버튼 가까이에 띄움 */
  let noteTimer = 0;
  function flashNote(el, text) {
    if (!el) return;   // 예전 HTML(캐시)에 안내 칸이 없으면 생략
    clearTimeout(noteTimer);
    root.querySelectorAll('.bk-step small.warn').forEach(x => { x.textContent = x.dataset.def || ''; x.classList.remove('warn'); });
    el.textContent = text; el.classList.add('warn');
    noteTimer = setTimeout(() => { el.textContent = el.dataset.def || ''; el.classList.remove('warn'); }, 3000);
    say(text);
  }
  /** 안내 칸의 기본 문구를 바꿈 (flashNote 가 끝나면 이 문구로 돌아감). 같은 문구면 다시 쓰지 않음 */
  function setNote(el, text) {
    if (!el) return;
    el.dataset.def = text;
    if (!el.classList.contains('warn') && el.textContent !== text) el.textContent = text;
  }

  function renderCourts() {
    const sp = CFG.spaces[state.space];
    const multi = sp.courts.length > 1;
    $('bkCourtWrap').style.display = multi ? '' : 'none';
    $('bkTimeNo').textContent = multi ? '03' : '02';
    timeNote(); fitNote();
    setNote($('bkCourtNote'), `여러 코트 선택 가능 (최대 ${courtMax(sp)}면)`);
    if ($('bkLegendPart')) $('bkLegendPart').hidden = !multi;   // '일부 코트만' 표시는 코트가 여럿일 때만 생김
    $('bkCourts').innerHTML = sp.courts.map((c, i) => {
      const n = [...state.sel.values()].filter(x => x.court === i).length;   // 이 코트에 담긴 시간 수 (모든 날짜)
      const on = state.courts.includes(i);
      return `<button type="button" data-court="${i}" class="${on ? 'on' : ''}" aria-pressed="${on}">${c}${n ? `<i>${n}</i>` : ''}</button>`;
    }).join('');
  }
  $('bkCourts').addEventListener('click', e => {
    const b = e.target.closest('button[data-court]'); if (!b) return;
    const i = +b.dataset.court, max = courtMax(CFG.spaces[state.space]);
    if (state.courts.includes(i)) {
      if (state.courts.length === 1) { flashNote($('bkCourtNote'), '코트는 최소 1면 선택해야 합니다'); return; }
      state.courts = state.courts.filter(c => c !== i);
    } else {
      if (state.courts.length >= max) { flashNote($('bkCourtNote'), `코트는 최대 ${max}면까지 선택 가능`); return; }
      state.courts = state.courts.concat(i).sort((a, b) => a - b);
    }
    state.anchor = null;   // 코트 묶음이 바뀌면 시작점 해제 (시작점은 '고른 코트 모두에 담긴 칸')
    const focused = document.activeElement === b;
    renderCourts(); renderSlots();
    if (focused) $('bkCourts').querySelector(`[data-court="${i}"]`).focus();   // 다시 그린 버튼으로 키보드 포커스 유지
  });

  /* ---------- slots ---------- */
  function isPast(date, start) {
    const now = new Date();
    return date === ymd(now) && mins(start) <= now.getHours() * 60 + now.getMinutes();
  }
  /** 고른 코트들 기준 그 칸이 막힌 이유 — 지난 시간이면 "~ 끝", 고른 코트 중 예약된 게 있으면 "예약됨"/"코트 2 예약됨", 아니면 '' */
  function blockWhy(x) {
    const taken = booked[state.space + '|' + state.date] || new Set();
    const busy = state.courts.filter(c => taken.has(`${c}|${x.start}`));
    if (isPast(state.date, x.start)) return '~ ' + x.end;
    return busy.length ? (busy.length === state.courts.length ? '예약됨' : courtLabel(CFG.spaces[state.space], busy) + ' 예약됨') : '';
  }
  /** 고른 코트들 기준 그 시간 칸의 모양 (sub 는 <small> 안 HTML — 코트 이름·시간은 설정값이라 그대로 씀)
      off: 지난 시간이거나 고른 코트 중 하나라도 이미 예약됨 (어느 코트가 막혔는지 작은 회색 글씨로) — 버튼 disabled
      on: 고른 코트 모두에 담김 / part: 일부 코트에만 담김 (시간을 담은 뒤 코트 선택을 바꾼 경우)
      lock: 막혔는데 고른 코트 중 담아 둔 것이 있음 (담은 뒤 코트를 추가했거나 조회 결과가 늦게 옴)
            — 막힌 이유 + 담긴 코트를 같이 보여주고, 누르면 담긴 코트만 뺌 (예약 내역 × 까지 안 내려가도 되게) */
  function slotView(x) {
    const sp = CFG.spaces[state.space];
    const has = state.courts.filter(c => state.sel.has(`${state.date}|${c}|${x.start}`));
    const on = has.length === state.courts.length, part = !on && has.length > 0;
    const why = blockWhy(x);
    if (why && has.length) {
      return { off: false, cls: 'lock', pressed: on ? 'true' : 'mixed', sub: `${why}<em>${on ? '' : courtLabel(sp, has) + ' '}담김</em>` };
    }
    return { off: !!why, cls: on ? 'on' : part ? 'part' : '', pressed: on ? 'true' : part ? 'mixed' : 'false',
      sub: why || (part ? courtLabel(sp, has) + '만' : '~ ' + x.end) };
  }

  /* 이어서 선택 — 빈 시간을 누르면 그 칸이 시작점, 다음에 같은 날 다른 시간을 누르면 그 사이를 한 번에 담음.
     '이어진' 은 그 날 시간 칸 목록의 인접 순서(index) 기준 — 요가의 10분 쉬는 시간이 있어도 이어진 칸 */
  const ANCHOR_NOTE = '끝 시간을 누르면 이어서 선택돼요';
  const GAP_WARN = '중간에 예약된 시간이 있어 이어서 선택할 수 없어요';
  const MAX_WARN = `최대 ${MAX}시간까지 신청 가능`;
  /** 시간 제목 옆 안내 — 시작점이 있으면 이어서 선택 안내, 없으면 공간 기본 안내 */
  function timeNote() { setNote($('bkTimeNote'), state.anchor ? ANCHOR_NOTE : CFG.spaces[state.space].note || ''); }
  /** 시간 안내 칸 높이 고정 — 이 공간에서 나올 수 있는 문구(기본 안내 · 시작점 안내 · 경고)를 #bkTimeFit 에 투명하게 겹쳐 두어
      늘 가장 긴 문구 높이만큼 자리를 잡음 (style.css .bk-note) → 안내 줄 수가 바뀌어도 아래 시간 격자가 위아래로 밀리지 않음 */
  function fitNote() {
    const fit = $('bkTimeFit');
    if (!fit || fit.dataset.space === state.space) return;   // 공간이 바뀔 때만 다시 채움
    fit.dataset.space = state.space;
    fit.innerHTML = [CFG.spaces[state.space].note || '', ANCHOR_NOTE].map(t => `<small>${esc(t)}</small>`).join('')
      + [GAP_WARN, MAX_WARN].map(t => `<small class="w">${esc(t)}</small>`).join('');   // 경고는 굵은 글씨(.warn)라 폭이 더 넓음
  }
  /** 시간 격자 경고 — 제목 옆 안내에 잠깐 띄우고, 그 안내가 화면 밖이거나 위쪽 고정 메뉴·탭에 가려 있으면 화면 아래에도 잠깐 띄움
      (휴대폰에서 저녁 시간을 누르면 '시간 선택' 제목은 한참 위라 왜 안 담겼는지 안 보임) */
  let toastEl = null, toastTimer = 0;
  function warnTime(text) {
    const el = $('bkTimeNote');
    flashNote(el, text);
    const r = el && el.getBoundingClientRect();
    const hit = r && document.elementFromPoint(r.left + 2, r.top + r.height / 2);
    if (hit && el.contains(hit)) return;   // 안내가 보이면 그걸로 충분
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'bk-toast'; toastEl.setAttribute('aria-hidden', 'true');   // 읽기는 say() 가 함
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }
  /** 시작점이 아직 쓸 수 있는지 확인 — 다른 날짜이거나, 그 칸이 더는 '고른 코트 모두에 담긴 칸(on)' 이 아니면 해제
      (늦게 온 예약 조회로 막힘 · 예약 내역 × 로 빠짐 · 신청 후 비워짐 · 그 사이 시간이 지남) */
  function checkAnchor() {
    const a = state.anchor;
    if (a && (a.date !== state.date || slotView(a).cls !== 'on')) state.anchor = null;
    timeNote();
  }
  /** 시간 버튼 안쪽 — 시작점 칸엔 위쪽 가운데 작은 '시작' 표시 */
  function slotInner(x, v) {
    const anc = state.anchor && state.anchor.start === x.start;
    return `<b>${x.start}</b><small>${v.sub}</small>${anc ? '<i class="bk-anc">시작</i>' : ''}`;
  }
  const slotCls = (x, v) => v.cls + (state.anchor && state.anchor.start === x.start ? ' anchor' : '');
  function renderSlots() {
    checkAnchor();
    const list = slotsFor(state.space, state.date);
    if (!list.length) { $('bkSlots').innerHTML = '<p class="bk-none">이 날은 대관 가능한 시간이 없습니다.</p>'; return; }
    const btn = x => {
      const v = slotView(x);
      return `<button type="button" data-s="${x.start}" data-e="${x.end}" class="${slotCls(x, v)}" aria-pressed="${v.pressed}"${v.off ? ' disabled' : ''}>${slotInner(x, v)}</button>`;
    };
    // 오전(시작 12:00 전) / 오후 소제목으로 묶어서 표시 — 비어 있는 묶음은 생략
    const groups = [['오전', list.filter(x => mins(x.start) < 720)], ['오후', list.filter(x => mins(x.start) >= 720)]];
    $('bkSlots').innerHTML = groups.filter(g => g[1].length)
      .map(([h, xs]) => `<div class="bk-sg"><div class="bk-sg-h">${h}</div><div class="bk-sg-grid">${xs.map(btn).join('')}</div></div>`).join('');
  }
  /** 이미 그려진 시간 버튼들을 그 자리에서 고침 — 범위로 여러 칸이 바뀌어도 누른 버튼의 키보드 포커스가 남게 (다시 그리면 사라짐) */
  function paintSlots() {
    checkAnchor();
    $('bkSlots').querySelectorAll('button[data-s]').forEach(b => {
      const x = { start: b.dataset.s, end: b.dataset.e }, v = slotView(x);
      b.className = slotCls(x, v); b.setAttribute('aria-pressed', v.pressed); b.innerHTML = slotInner(x, v);
      b.disabled = v.off;      // lock 칸에서 담긴 코트를 빼면 그냥 막힌 칸이 됨
    });
  }
  // 시간 칸 누름 (담기·빼기는 고른 코트 모두에, 1코트 1시간씩)
  //  - 고른 코트 모두에 담긴 칸(on) · 막혔는데 담아 둔 칸(lock) → 그 칸에서 고른 코트를 모두 뺌 + 시작점 해제
  //  - 빈 칸 · 일부 코트만 담긴 칸(part) → 빠진 코트에 담음
  //      시작점이 없으면 → 누른 칸만 담고 그 칸이 시작점
  //      시작점이 있으면 → 시작점~누른 칸(양 끝 포함, 앞뒤 방향 모두)을 한 번에 담고 시작점 해제 (같은 날 떨어진 구간도 또 잡을 수 있게)
  //        사이에 지난·예약된 칸이 있으면 → 범위는 안 담고 안내, 누른 칸만 담아 새 시작점으로
  //  - 새로 담길 칸이 최대(MAX)를 넘으면 하나도 안 담음 (시작점은 그대로 — 더 가까운 끝을 다시 고를 수 있게)
  //  - 결과는 화면낭독기용 한 줄(say)로도 알림 — 범위로 바뀐 다른 버튼들의 aria-pressed 는 읽히지 않으므로
  $('bkSlots').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const x = { start: b.dataset.s, end: b.dataset.e };
    const now = slotView(x); if (now.off) { renderSlots(); return; }   // 그린 뒤 시간이 지났으면 막힌 칸으로 다시 그림
    clearDraft();
    const sp = CFG.spaces[state.space], who = cs => sp.courts.length > 1 ? courtLabel(sp, cs) + ' ' : '';   // 안내 앞머리 "코트 1·2 " (요가는 없음)
    let warn = '', said;
    if (now.cls === 'on' || now.cls === 'lock') {
      const gone = state.courts.filter(c => state.sel.delete(`${state.date}|${c}|${x.start}`));   // 실제로 빠진 코트 (lock 칸은 담긴 코트만)
      state.anchor = null;
      said = `${who(gone)}${tLabel(x)} 선택 해제`;
    } else {
      checkAnchor();   // 시작점 칸이 그사이 지났거나(오늘) 막혔으면 조용히 해제 — 누른 칸이 그냥 새 시작점 (지난 시작점 때문에 '중간에 예약된…' 이 뜨지 않게)
      const list = slotsFor(state.space, state.date), i = list.findIndex(s => s.start === x.start);
      const a = state.anchor ? list.findIndex(s => s.start === state.anchor.start) : -1;
      let span = [x];
      if (a >= 0 && i >= 0) {
        const range = list.slice(Math.min(a, i), Math.max(a, i) + 1);
        if (range.some(s => blockWhy(s))) warn = GAP_WARN;
        else span = range;
      }
      const add = [];   // 새로 담길 [키, 칸] — 이미 담긴 코트는 건너뜀
      span.forEach(s => state.courts.forEach(c => {
        const k = `${state.date}|${c}|${s.start}`;
        if (!state.sel.has(k)) add.push([k, { date: state.date, court: c, start: s.start, end: s.end }]);
      }));
      if (state.sel.size + add.length > MAX) {   // 넘으면 하나도 안 담음 (자세한 안내는 아래 bkMsg)
        showMsg(maxText(MAX, sp), 'err');
        paintSlots(); warnTime(MAX_WARN);   // paintSlots: 위 checkAnchor 로 풀린 시작점 표시 지움
        return;
      }
      add.forEach(([k, v]) => state.sel.set(k, v));
      state.anchor = span.length > 1 ? null : { date: state.date, start: x.start, end: x.end };
      said = span.length > 1
        ? `${who(state.courts)}${tLabel({ start: span[0].start, end: span[span.length - 1].end })} (${span.length}시간) 선택됨`
        : `${warn ? warn + '. ' : ''}${who(state.courts)}${tLabel(x)} 선택됨. ${ANCHOR_NOTE}`;
    }
    paintSlots();
    if (warn) warnTime(warn);   // 시작점 안내(timeNote)를 잠깐 덮었다가 3초 뒤 되돌아감 (+ 안 보이면 화면 아래)
    say(said);                  // warnTime 이 읽힐 문구를 경고만으로 바꿔 두므로 그 뒤에 결과까지 한 줄로
    renderSummary(); renderCourts();
  });

  /* ---------- summary ---------- */
  function items() {
    return [...state.sel.values()].sort((a, b) => (a.date + pad(a.court) + a.start).localeCompare(b.date + pad(b.court) + b.start));
  }
  /** 보여주기용 줄: 같은 날짜에서 코트 묶음이 같고 이어진 칸(그 날 시간 칸 목록의 인접 순서 — 요가 10분 쉬는 시간도 이어진 것으로)을
      한 줄로 묶음 ("10/15(목) 코트 1·2 · 13:00~15:00 (2시간)", 요가는 코트 없이 "10/16(금) 13:30~15:20 (2시간)"). 끝은 마지막 칸의 end, starts 는 그 줄의 칸 시작 시간들.
      신청·금액은 그대로 1코트 1시간 칸(items) 단위 — 칸이 빠지면(× · 신청 충돌) 다시 계산돼 저절로 쪼개짐 */
  function rows(list) {
    const m = new Map();   // 1) 같은 날짜·시간의 코트를 모음
    list.forEach(x => {
      const k = x.date + '|' + x.start;
      if (!m.has(k)) m.set(k, { date: x.date, start: x.start, end: x.end, courts: [] });
      m.get(k).courts.push(x.court);   // items() 가 코트 순으로 정렬돼 있어 courts 도 오름차순
    });
    const out = [];        // 2) 시간 순으로 놓고, 바로 앞 줄과 날짜·코트 묶음이 같고 칸이 이어지면 합침
    [...m.values()].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).forEach(c => {
      const i = slotsFor(state.space, c.date).findIndex(s => s.start === c.start), p = out[out.length - 1];
      if (p && p.date === c.date && i >= 0 && p.last === i - 1 && p.courts.join() === c.courts.join()) {
        p.end = c.end; p.last = i; p.starts.push(c.start);
      } else out.push({ date: c.date, courts: c.courts, start: c.start, end: c.end, last: i, starts: [c.start] });
    });
    return out;
  }
  const hours = r => `(${r.starts.length}시간)`;   // 그 줄의 칸 수 = 시간 수 (요가 50분 칸도 1시간 단위)
  function renderSummary() {
    const sp = CFG.spaces[state.space], list = items(), multi = sp.courts.length > 1;
    // × 는 그 줄(이어진 시간 × 코트들)을 한 번에 뺌
    $('bkList').innerHTML = list.length
      ? rows(list).map(r => {
        const head = `${dLabel(r.date)} ${multi ? courtLabel(sp, r.courts) + ' · ' : ''}${tLabel(r)}`, n = hours(r);
        const keys = r.starts.flatMap(t => r.courts.map(c => `${r.date}|${c}|${t}`));
        return `<li><span>${head} <small>${n}</small></span>
          <button type="button" data-k="${keys.join(',')}" aria-label="${head} ${n} 삭제">×</button></li>`;
      }).join('')
      : '<li class="empty">선택한 시간이 없습니다.</li>';
    $('bkTotal').textContent = won(list.length * sp.price);
    if ($('bkCount')) $('bkCount').textContent = list.length ? `${sp.unit} × ${list.length}` : '';
    validate();
  }
  $('bkList').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    b.dataset.k.split(',').forEach(k => state.sel.delete(k)); clearDraft();
    say(b.getAttribute('aria-label').replace(/ 삭제$/, ' 삭제됨'));
    renderSummary(); renderCourts(); renderSlots();
  });

  /* ---------- tabs ---------- */
  root.querySelector('.bk-tabs').addEventListener('click', e => {
    const b = e.target.closest('.bk-tab'); if (!b || b.dataset.space === state.space) return;
    root.querySelectorAll('.bk-tab').forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    state.space = b.dataset.space; state.courts = [0]; state.sel.clear(); state.anchor = null; showMsg('', '');
    ensureDate();
    renderCal(); renderCourts(); renderSummary(); renderSlots();
    loadBooked().then(renderSlots);
  });

  /* ---------- form ---------- */
  const form = $('bkForm');
  function validate() {
    const ok = state.sel.size > 0 && state.sel.size <= MAX && form.name.value.trim() && /^[0-9\-+ ]{9,}$/.test(form.phone.value.trim()) && form.agree.checked;
    $('bkSubmit').disabled = !ok;
    return ok;
  }
  form.addEventListener('input', validate);
  form.addEventListener('change', validate);

  function message(list) {
    const sp = CFG.spaces[state.space];
    return [
      '[THE SQUARE 대관 예약 신청]',
      `공간: ${sp.name}`,
      ...rows(list).map(r => `- ${dLabel(r.date)} ${sp.courts.length > 1 ? courtLabel(sp, r.courts) + ' ' : ''}${tLabel(r)} ${hours(r)}`),
      `합계: ${won(list.length * sp.price)} (${sp.unit} × ${list.length})`,
      `이름: ${form.name.value.trim()}`,
      `연락처: ${form.phone.value.trim()}`,
      form.people.value ? `인원: ${form.people.value}명` : '',
      form.memo.value.trim() ? `요청사항: ${form.memo.value.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  function showMsg(html, cls) { const m = $('bkMsg'); m.className = 'bk-msg ' + (cls || ''); m.innerHTML = html; }
  /** 선택이 바뀌면 이전 문자 신청 초안은 지움 (내용이 달라지므로) */
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
    if (!validate()) return;
    const list = items();
    const sp = CFG.spaces[state.space];
    // 신청 버튼을 누르면 시작점 해제 (접수 · 충돌 · 오류 · 문자 접수 모두) — 충돌로 빠진 시간을 다시 채우려 누른 칸이
    // 신청 전 시작점과 이어져 엉뚱한 범위가 한꺼번에 담기지 않게
    state.anchor = null; paintSlots();

    if (!CFG.api) {
      const text = message(list);
      const sms = `sms:${sp.phone.replace(/-/g, '')}?&body=${encodeURIComponent(text)}`;
      showMsg(`<b>예약 내용을 문자로 보내주세요.</b><br>아래 버튼을 누르면 예약 내용이 문자로 작성됩니다. 전송해주시면 확인 후 연락드립니다.
        <pre>${esc(text)}</pre>
        <div class="bk-actions"><a class="bk-submit" href="${sms}">문자로 예약 신청</a>
        <button type="button" class="bk-copy">내용 복사</button></div>
        <small>PC에서는 내용을 복사해 ${sp.phone}로 문자 보내주세요.</small>`, 'info');
      const m = $('bkMsg');
      m.querySelector('.bk-copy').onclick = ev => copyText(text, ev.currentTarget, m.querySelector('pre'));
      return;
    }

    $('bkSubmit').disabled = true; $('bkSubmit').textContent = '신청 중…';
    try {
      const res = await fetch(CFG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'book', space: state.space,
          items: list.map(({ date, court, start }) => ({ date, court, start })),
          name: form.name.value.trim(), phone: form.phone.value.trim(),
          people: form.people.value, memo: form.memo.value.trim(),
        }),
      });
      const r = await res.json();
      if (r.ok) {
        showMsg(`<b>예약 신청이 접수되었습니다.</b><br>신청번호 ${esc(r.id)} · 확인 후 ${esc(form.phone.value.trim())}로 연락드립니다.`, 'ok');
        state.sel.clear(); form.reset();
        Object.keys(booked).forEach(k => delete booked[k]);
      } else if (r.error === 'too_many') {
        showMsg(maxText(r.max || MAX, sp), 'err');
      } else if (r.error === 'invalid_item') {
        showMsg('선택한 날짜 중 예약 범위를 벗어난 날이 있습니다. 날짜를 다시 선택해주세요.', 'err');
      } else if (r.error === 'conflict') {
        showMsg('선택하신 시간 중 방금 다른 예약이 들어온 시간이 있습니다. 시간을 다시 확인해주세요.', 'err');
        (r.conflicts || []).forEach(c => state.sel.delete(`${c.date}|${c.court}|${c.start}`));
        Object.keys(booked).forEach(k => delete booked[k]);
      } else throw new Error(r.error || 'fail');
    } catch (err) {
      showMsg(`예약 신청 중 오류가 발생했습니다. 전화(${CFG.spaces[state.space].phone})로 문의해주세요.`, 'err');
    }
    $('bkSubmit').textContent = '예약 신청';
    renderSummary(); renderCourts(); renderSlots();
    loadBooked().then(renderSlots);
  });

  /* ---------- availability ---------- */
  async function loadBooked() {
    const k = state.space + '|' + state.date;
    if (!CFG.api || booked[k]) return;
    try {
      const r = await (await fetch(`${CFG.api}?action=slots&space=${state.space}&date=${state.date}`)).json();
      booked[k] = new Set((r.slots || []).map(x => `${x.court}|${x.start}`));
    } catch (e) { /* 조회 실패 시 전체 가능으로 표시 */ }
  }

  ensureDate();
  renderCal(); renderCourts(); renderSummary(); renderSlots();
  loadBooked().then(renderSlots);
})();
