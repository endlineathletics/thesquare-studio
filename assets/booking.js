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
  // month: 달력에서 보고 있는 달 ("YYYY-MM") — ensureDate() 가 선택 날짜에 맞춰 둠
  const state = { space: root.querySelector('.bk-tab.on').dataset.space, date: ymd(new Date()), month: '', court: 0, sel: new Map() };
  const booked = {};   // "space|date" -> Set("court|start")

  /** 그 날짜에 예약 가능한 시간 칸 [{start, end}] */
  function slotsFor(space, date) {
    return (CFG.spaces[space].slots[toDate(date).getDay()] || []).map(s => { const [start, end] = s.split('-'); return { start, end }; });
  }
  const tLabel = x => `${x.start}~${x.end}`;

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
    state.date = b.dataset.date;
    state.month = state.date.slice(0, 7);   // 전월/익월 날짜를 고르면 그 달로 이동
    renderCal(); renderSlots();
    loadBooked().then(renderSlots);
  });

  /* ---------- courts ---------- */
  function renderCourts() {
    const sp = CFG.spaces[state.space];
    const multi = sp.courts.length > 1;
    $('bkCourtWrap').style.display = multi ? '' : 'none';
    $('bkTimeNo').textContent = multi ? '03' : '02';
    $('bkTimeNote').textContent = sp.note || '';
    $('bkCourts').innerHTML = sp.courts.map((c, i) => {
      const n = [...state.sel.values()].filter(x => x.court === i).length;
      return `<button type="button" data-court="${i}" class="${i === state.court ? 'on' : ''}">${c}${n ? `<i>${n}</i>` : ''}</button>`;
    }).join('');
  }
  $('bkCourts').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.court = +b.dataset.court;
    renderCourts(); renderSlots();
  });

  /* ---------- slots ---------- */
  function isPast(date, start) {
    const now = new Date();
    return date === ymd(now) && mins(start) <= now.getHours() * 60 + now.getMinutes();
  }
  function renderSlots() {
    const taken = booked[state.space + '|' + state.date] || new Set();
    const list = slotsFor(state.space, state.date);
    if (!list.length) { $('bkSlots').innerHTML = '<p class="bk-none">이 날은 대관 가능한 시간이 없습니다.</p>'; return; }
    const btn = x => {
      const key = `${state.date}|${state.court}|${x.start}`;
      const past = isPast(state.date, x.start);
      const off = past || taken.has(`${state.court}|${x.start}`);
      return `<button type="button" data-s="${x.start}" data-e="${x.end}" class="${state.sel.has(key) ? 'on' : ''}" ${off ? 'disabled' : ''}>
        <b>${x.start}</b><small>${off && !past ? '예약됨' : '~ ' + x.end}</small></button>`;
    };
    // 오전(시작 12:00 전) / 오후 소제목으로 묶어서 표시 — 비어 있는 묶음은 생략
    const groups = [['오전', list.filter(x => mins(x.start) < 720)], ['오후', list.filter(x => mins(x.start) >= 720)]];
    $('bkSlots').innerHTML = groups.filter(g => g[1].length)
      .map(([h, xs]) => `<div class="bk-sg"><div class="bk-sg-h">${h}</div><div class="bk-sg-grid">${xs.map(btn).join('')}</div></div>`).join('');
  }
  $('bkSlots').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const key = `${state.date}|${state.court}|${b.dataset.s}`;
    clearDraft();
    if (state.sel.has(key)) state.sel.delete(key);
    else if (state.sel.size >= MAX) { showMsg(`한 번에 최대 ${MAX}시간까지 신청할 수 있습니다. 나눠서 신청해주세요.`, 'err'); return; }
    else state.sel.set(key, { date: state.date, court: state.court, start: b.dataset.s, end: b.dataset.e });
    b.classList.toggle('on');
    renderSummary(); renderCourts();
  });

  /* ---------- summary ---------- */
  function items() {
    return [...state.sel.values()].sort((a, b) => (a.date + pad(a.court) + a.start).localeCompare(b.date + pad(b.court) + b.start));
  }
  function renderSummary() {
    const sp = CFG.spaces[state.space], list = items();
    $('bkList').innerHTML = list.length
      ? list.map(x => `<li><span>${dLabel(x.date)} ${sp.courts.length > 1 ? sp.courts[x.court] + ' · ' : ''}${tLabel(x)}</span>
          <button type="button" data-k="${x.date}|${x.court}|${x.start}" aria-label="삭제">×</button></li>`).join('')
      : '<li class="empty">선택한 시간이 없습니다.</li>';
    $('bkTotal').textContent = won(list.length * sp.price);
    validate();
  }
  $('bkList').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    state.sel.delete(b.dataset.k); clearDraft();
    renderSummary(); renderCourts(); renderSlots();
  });

  /* ---------- tabs ---------- */
  root.querySelector('.bk-tabs').addEventListener('click', e => {
    const b = e.target.closest('.bk-tab'); if (!b || b.dataset.space === state.space) return;
    root.querySelectorAll('.bk-tab').forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    state.space = b.dataset.space; state.court = 0; state.sel.clear(); showMsg('', '');
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
      ...list.map(x => `- ${dLabel(x.date)} ${sp.courts.length > 1 ? sp.courts[x.court] + ' ' : ''}${tLabel(x)}`),
      `합계: ${won(list.length * sp.price)}`,
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
        showMsg(`한 번에 최대 ${r.max || MAX}시간까지 신청할 수 있습니다. 나눠서 신청해주세요.`, 'err');
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
