(function () {
  const root = document.getElementById('bk');
  if (!root) return;
  const CFG = window.BOOKING;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const won = n => n.toLocaleString('ko-KR') + '원';
  const dLabel = s => { const d = new Date(s + 'T00:00'); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
  const hLabel = h => `${pad(h)}:00~${pad(h + 1)}:00`;

  const state = { space: 'badminton', date: ymd(new Date()), court: 0, sel: new Map() };
  const booked = {};   // "space|date" -> Set("court|hour")

  /* ---------- dates ---------- */
  function renderDates() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let h = '';
    for (let i = 0; i < CFG.days; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const v = ymd(d), wd = d.getDay();
      h += `<button type="button" data-date="${v}" class="${v === state.date ? 'on' : ''} ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}">
        <small>${i === 0 ? '오늘' : WD[wd]}</small><b>${d.getDate()}</b><small>${d.getMonth() + 1}월</small></button>`;
    }
    $('bkDates').innerHTML = h;
  }
  $('bkDates').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.date = b.dataset.date;
    $('bkDates').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    loadBooked().then(renderSlots);
  });

  /* ---------- courts ---------- */
  function renderCourts() {
    const sp = CFG.spaces[state.space];
    const multi = sp.courts.length > 1;
    $('bkCourtWrap').style.display = multi ? '' : 'none';
    $('bkTimeNo').textContent = multi ? '03' : '02';
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
  function isPast(date, h) {
    const now = new Date();
    return date === ymd(now) && h <= now.getHours();
  }
  function renderSlots() {
    const taken = booked[state.space + '|' + state.date] || new Set();
    let h = '';
    for (let hr = 0; hr < 24; hr++) {
      const key = `${state.date}|${state.court}|${hr}`;
      const off = isPast(state.date, hr) || taken.has(`${state.court}|${hr}`);
      const on = state.sel.has(key);
      h += `<button type="button" data-h="${hr}" class="${on ? 'on' : ''}" ${off ? 'disabled' : ''}>
        <b>${pad(hr)}:00</b><small>${off && !isPast(state.date, hr) ? '예약됨' : '~ ' + pad(hr + 1) + ':00'}</small></button>`;
    }
    $('bkSlots').innerHTML = h;
  }
  $('bkSlots').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const hr = +b.dataset.h, key = `${state.date}|${state.court}|${hr}`;
    if (state.sel.has(key)) state.sel.delete(key);
    else state.sel.set(key, { date: state.date, court: state.court, hour: hr });
    b.classList.toggle('on');
    renderSummary(); renderCourts();
  });

  /* ---------- summary ---------- */
  function items() {
    return [...state.sel.values()].sort((a, b) => (a.date + pad(a.court) + pad(a.hour)).localeCompare(b.date + pad(b.court) + pad(b.hour)));
  }
  function renderSummary() {
    const sp = CFG.spaces[state.space], list = items();
    $('bkList').innerHTML = list.length
      ? list.map(x => `<li><span>${dLabel(x.date)} ${sp.courts.length > 1 ? sp.courts[x.court] + ' · ' : ''}${hLabel(x.hour)}</span>
          <button type="button" data-k="${x.date}|${x.court}|${x.hour}" aria-label="삭제">×</button></li>`).join('')
      : '<li class="empty">선택한 시간이 없습니다.</li>';
    $('bkTotal').textContent = won(list.length * sp.price);
    validate();
  }
  $('bkList').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    state.sel.delete(b.dataset.k);
    renderSummary(); renderCourts(); renderSlots();
  });

  /* ---------- tabs ---------- */
  root.querySelector('.bk-tabs').addEventListener('click', e => {
    const b = e.target.closest('.bk-tab'); if (!b || b.dataset.space === state.space) return;
    root.querySelectorAll('.bk-tab').forEach(x => x.classList.toggle('on', x === b));
    state.space = b.dataset.space; state.court = 0; state.sel.clear();
    renderCourts(); renderSummary();
    loadBooked().then(renderSlots);
  });

  /* ---------- form ---------- */
  const form = $('bkForm');
  function validate() {
    const ok = state.sel.size > 0 && form.name.value.trim() && /^[0-9\-+ ]{9,}$/.test(form.phone.value.trim()) && form.agree.checked;
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
      ...list.map(x => `- ${dLabel(x.date)} ${sp.courts.length > 1 ? sp.courts[x.court] + ' ' : ''}${hLabel(x.hour)}`),
      `합계: ${won(list.length * sp.price)}`,
      `이름: ${form.name.value.trim()}`,
      `연락처: ${form.phone.value.trim()}`,
      form.people.value ? `인원: ${form.people.value}명` : '',
      form.memo.value.trim() ? `요청사항: ${form.memo.value.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  function showMsg(html, cls) { const m = $('bkMsg'); m.className = 'bk-msg ' + (cls || ''); m.innerHTML = html; }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) return;
    const list = items();
    const sp = CFG.spaces[state.space];

    if (!CFG.api) {
      const text = message(list);
      const sms = `sms:${CFG.phone.replace(/-/g, '')}?&body=${encodeURIComponent(text)}`;
      showMsg(`<b>예약 내용을 문자로 보내주세요.</b><br>아래 버튼을 누르면 예약 내용이 문자로 작성됩니다. 전송해주시면 확인 후 연락드립니다.
        <pre>${text.replace(/</g, '&lt;')}</pre>
        <div class="bk-actions"><a class="bk-submit" href="${sms}">문자로 예약 신청</a>
        <button type="button" class="bk-copy">내용 복사</button></div>
        <small>PC에서는 내용을 복사해 ${CFG.phone}로 문자 보내주세요.</small>`, 'info');
      $('bkMsg').querySelector('.bk-copy').onclick = ev => {
        navigator.clipboard && navigator.clipboard.writeText(text).then(() => { ev.target.textContent = '복사됨 ✓'; });
      };
      return;
    }

    $('bkSubmit').disabled = true; $('bkSubmit').textContent = '신청 중…';
    try {
      const res = await fetch(CFG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'book', space: state.space, spaceName: sp.name, courts: sp.courts, price: sp.price,
          items: list, name: form.name.value.trim(), phone: form.phone.value.trim(),
          people: form.people.value, memo: form.memo.value.trim(),
        }),
      });
      const r = await res.json();
      if (r.ok) {
        showMsg(`<b>예약 신청이 접수되었습니다.</b><br>신청번호 ${r.id} · 확인 후 ${form.phone.value.trim()}로 연락드립니다.`, 'ok');
        state.sel.clear(); form.reset();
        Object.keys(booked).forEach(k => delete booked[k]);
      } else if (r.error === 'conflict') {
        showMsg('선택하신 시간 중 방금 다른 예약이 들어온 시간이 있습니다. 시간을 다시 확인해주세요.', 'err');
        (r.conflicts || []).forEach(c => state.sel.delete(`${c.date}|${c.court}|${c.hour}`));
        delete booked[state.space + '|' + state.date];
      } else throw new Error(r.error || 'fail');
    } catch (err) {
      showMsg(`예약 신청 중 오류가 발생했습니다. 전화(${CFG.phone})로 문의해주세요.`, 'err');
    }
    $('bkSubmit').textContent = '예약 신청';
    renderSummary(); renderCourts();
    loadBooked().then(renderSlots);
  });

  /* ---------- availability ---------- */
  async function loadBooked() {
    const k = state.space + '|' + state.date;
    if (!CFG.api || booked[k]) return;
    try {
      const r = await (await fetch(`${CFG.api}?action=slots&space=${state.space}&date=${state.date}`)).json();
      booked[k] = new Set((r.slots || []).map(x => `${x.court}|${x.hour}`));
    } catch (e) { /* 조회 실패 시 전체 가능으로 표시 */ }
  }

  renderDates(); renderCourts(); renderSummary(); renderSlots();
  loadBooked().then(renderSlots);
})();
