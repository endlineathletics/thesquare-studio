/* 원데이(1일 체험권) 신청 — oneday.html (2026-11-11)
   관리프로그램 /api/site:
   - GET  action=oneday_slots&grade=  → 앞으로 2주 날짜별 타임 { id, cls, days, time, end, price, ok } (ok = 정원이 남고 급수가 맞음)
   - POST pay_prepare kind 'oneday'   → 결제창 값 (서버가 자리·급수를 다시 확인, 금액도 서버가 정함)
   - POST pay_cancel  kind 'oneday'   → 결제창 닫기·오류
   결제가 끝나면 관리프로그램이 이 화면(?pay=ok|fail&no=OD…)으로 돌려보낸다 → 결과 화면. 결제가 끝나야 신청이 접수된다. */
(function () {
  const form = document.getElementById('odForm');
  if (!form) return;
  form.addEventListener('submit', e => e.preventDefault());
  const CFG = Object.assign({}, window.APPLY);
  CFG.phone = (CFG.phone && typeof CFG.phone === 'object') ? (CFG.phone.badminton || '') : (CFG.phone || '');
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const isPayTest = () => new URLSearchParams(location.search).get('paytest') === '1';
  const PAY_KEY = 'odPay';
  const PAY_MSGS = ['결제가 완료되지 않았어요.', '결제가 취소됐거나 인증되지 않았어요.', '이미 끝났거나 취소된 결제예요.',
    '신청 내용이 바뀌어 결제하지 않았어요.', '카드 승인이 되지 않았어요.', '결제 승인 중 연결이 끊겨 결제를 취소했어요.',
    '결제 결과를 확인하고 있어요. 결과는 문자로 알려드릴게요.', '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.'];
  const PAY_UNKNOWN = PAY_MSGS[6];
  const payMsgOk = m => PAY_MSGS.includes(m) || /^결제 시간\(\d{1,3}분\)이 지났어요\.$/.test(m);
  const ERR = { already_paid: '이미 결제가 끝났어요.', in_progress: '결제를 확인하고 있어요. 잠시 뒤 다시 확인해주세요.' };
  const st = { days: [], day: '', slot: null, busy: false, cid: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()) };

  async function post(body) {
    const res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return res.json();
  }
  function stash(v) { try { if (v) sessionStorage.setItem(PAY_KEY, JSON.stringify(v)); else sessionStorage.removeItem(PAY_KEY); } catch (e) { /* 그대로 */ } }
  function stashed() { try { const v = JSON.parse(sessionStorage.getItem(PAY_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function cutBytes(s, n) {
    let out = '', len = 0;
    for (const ch of String(s || '')) {
      const p = ch.codePointAt(0), b = p < 0x80 ? 1 : p < 0x800 ? 2 : p < 0x10000 ? 3 : 4;
      if (len + b > n) break;
      out += ch; len += b;
    }
    return out;
  }

  /* ---------- 결제창 (apply.js 와 같은 두 길 — Start 키 AUTHNICE / 정식 MID goPay) ---------- */
  let sdk = null, npgSdk = null;
  function loadScript(src, ready) {
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      const t = setTimeout(() => no(new Error('sdk_timeout')), 20000);
      s.src = src; s.async = true;
      s.onload = () => { clearTimeout(t); if (ready()) ok(); else no(new Error('sdk')); };
      s.onerror = () => { clearTimeout(t); s.remove(); no(new Error('sdk_load')); };
      document.head.appendChild(s);
    });
  }
  function loadSdk() {
    if (window.AUTHNICE) return Promise.resolve();
    if (!sdk) sdk = loadScript(CFG.paySdk, () => !!window.AUTHNICE).catch(e => { sdk = null; throw e; });
    return sdk;
  }
  function loadNpg() {
    if (typeof window.goPay === 'function') return Promise.resolve();
    if (!npgSdk) npgSdk = loadScript('https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js', () => typeof window.goPay === 'function')
      .catch(e => { npgSdk = null; throw e; });
    return npgSdk;
  }
  function payWindow(p, o, onFail) {
    if (p.pg === 'npg') {
      const old = $('npgPayForm');
      if (old) old.remove();
      const f = document.createElement('form');
      f.id = 'npgPayForm'; f.name = 'npgPayForm'; f.method = 'post'; f.action = p.returnUrl; f.hidden = true;
      f.setAttribute('accept-charset', 'euc-kr');
      for (const [k, v] of Object.entries(p.form || {})) {
        const i = document.createElement('input');
        i.type = 'hidden'; i.name = k; i.value = v == null ? '' : String(v);
        f.appendChild(i);
      }
      document.body.appendChild(f);
      window.nicepaySubmit = () => f.submit();
      window.nicepayClose = () => { const m = f.elements.AuthResultMsg; onFail(m ? m.value : ''); };
      window.goPay(f);
      return;
    }
    window.AUTHNICE.requestPay({
      clientId: p.clientId, method: CFG.payMethod || 'card', orderId: p.orderId, amount: p.amount, goodsName: p.goodsName,
      returnUrl: p.returnUrl, buyerName: cutBytes(o.name, 30), buyerTel: String(o.phone || '').replace(/\D/g, ''),
      fnError: res => onFail(res && (res.errorMsg || res.msg)),
    });
  }

  /* ---------- 입력 ---------- */
  form.phone.addEventListener('input', () => {
    const d = form.phone.value.replace(/\D/g, '').slice(0, 11);
    form.phone.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
  });
  const fld = k => form.querySelector(`.fld[data-f="${k}"]`);
  const setErr = (k, on) => { const f = fld(k); if (f) f.classList.toggle('err', !!on); };
  ['name', 'phone', 'grade', 'agree'].forEach(k => form.querySelectorAll(`[name=${k}]`).forEach(el => el.addEventListener('input', () => { setErr(k, false); sum(); })));
  form.agree.addEventListener('change', () => setErr('agree', false));

  /* ---------- 날짜·시간 ---------- */
  async function load() {
    const g = form.grade.value;
    if (!g) {
      $('odDays').innerHTML = ''; $('odTimes').innerHTML = '';
      $('odNote').hidden = false;
      return;
    }
    $('odTimes').innerHTML = '<p class="ap-note">시간을 불러오는 중…</p>';
    let r;
    try { r = await (await fetch(`${CFG.api}?action=oneday_slots&grade=${encodeURIComponent(g)}`)).json(); }
    catch (e) { r = null; }
    if (!r || !r.ok) { $('odTimes').innerHTML = `<p class="ap-note">시간을 불러오지 못했어요. 잠시 뒤 다시 골라 주세요. 계속 안 되면 ${esc(CFG.phone)}로 연락 주세요.</p>`; return; }
    if (!r.enabled && !isPayTest()) { $('odTimes').innerHTML = `<p class="ap-note">지금은 온라인 원데이 신청을 받지 않아요. ${esc(CFG.phone)}로 연락 주세요.</p>`; $('odDays').innerHTML = ''; return; }
    st.days = r.days || [];
    $('odNote').innerHTML = r.byGrade ? '<b>마감</b>은 정원이 찼거나 고르신 급수와 맞지 않는 시간이에요.' : '<b>마감</b>은 정원이 찬 시간이에요.';
    const keep = st.days.find(x => x.d === st.day && x.slots.some(s => s.ok));
    st.day = keep ? keep.d : ((st.days.find(x => x.slots.some(s => s.ok)) || {}).d || '');
    if (st.slot && !(keep && keep.slots.some(s => s.ok && s.id === st.slot.id))) st.slot = null;
    drawDays();
  }
  function drawDays() {
    if (!st.days.length) { $('odDays').innerHTML = ''; $('odTimes').innerHTML = `<p class="ap-note">앞으로 2주 동안 신청할 수 있는 수업이 없어요. ${esc(CFG.phone)}로 연락 주세요.</p>`; return; }
    $('odDays').innerHTML = st.days.map(x => {
      const n = x.slots.filter(s => s.ok).length;
      return `<button type="button" data-d="${esc(x.d)}" class="${x.d === st.day ? 'on' : ''}"${n ? '' : ' disabled'} aria-pressed="${x.d === st.day}">${esc(x.label)}${n ? '' : '<small>마감</small>'}</button>`;
    }).join('');
    $('odDays').querySelectorAll('button').forEach(b => b.onclick = () => { st.day = b.dataset.d; st.slot = null; setErr('slot', false); drawDays(); sum(); });
    drawTimes();
  }
  function drawTimes() {
    const day = st.days.find(x => x.d === st.day);
    if (!day) { $('odTimes').innerHTML = '<p class="ap-note">날짜를 골라 주세요.</p>'; return; }
    $('odTimes').innerHTML = `<div class="chips2">${day.slots.map(s => {
      const on = st.slot && st.slot.id === s.id;
      return `<label${s.ok ? '' : ' class="off"'}><input type="radio" name="odslot" value="${s.id}"${on ? ' checked' : ''}${s.ok ? '' : ' disabled'}>`
        + `<span>${esc(s.time)}–${esc(s.end)} · ${esc(s.cls)}${s.ok ? ` <small>${won(s.price)}</small>` : '<small>마감</small>'}</span></label>`;
    }).join('')}</div>`;
    $('odTimes').querySelectorAll('input').forEach(i => i.onchange = () => {
      st.slot = day.slots.find(s => String(s.id) === i.value) || null;
      setErr('slot', false); sum();
    });
  }
  form.grade.addEventListener('change', () => { setErr('grade', false); load(); sum(); });

  function picked() {
    const day = st.days.find(x => x.d === st.day);
    return st.slot && day ? { day, slot: st.slot } : null;
  }
  function sum() {
    const p = picked();
    const rows = [['이름', form.name.value.trim()], ['연락처', form.phone.value], ['급수', form.grade.value],
      ['일시', p ? `${p.day.label} ${p.slot.time}–${p.slot.end}` : ''], ['수업', p ? p.slot.cls : ''], ['금액', p ? won(p.slot.price) : '']];
    $('odSum').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd${v ? '' : ' class="empty"'}>${esc(v || '-')}</dd>`).join('');
  }
  sum();

  /* ---------- 제출 → 이용 안내 → 확인 → 결제 ---------- */
  $('odSubmit').addEventListener('click', async () => {
    if (st.busy) return;
    const name = form.name.value.trim(), phone = form.phone.value, d = phone.replace(/\D/g, '');
    const bad = { name: !name, phone: !/^01[016789]\d{7,8}$/.test(d), grade: !form.grade.value, slot: !picked(), agree: !form.agree.checked };
    Object.entries(bad).forEach(([k, v]) => setErr(k, v));
    const first = Object.keys(bad).find(k => bad[k]);
    $('odErr').textContent = '';
    if (first) { fld(first).scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const g = await window.PAYUI.guide({ api: CFG.api, key: 'refund_class', phone: CFG.phone,
      check: '레슨 이용수칙과 결석·시간 변경·환불 규정을 확인했습니다.', okText: '확인하고 신청 계속하기' });
    if (!g) return;
    const p = picked();
    const o = { name, phone, grade: form.grade.value, slot: p.slot, day: p.day, test: isPayTest() };
    const yes = await window.PAYUI.confirm({ title: '결제 전에 확인해 주세요',
      rows: [['원데이', `${p.day.label} ${p.slot.time}–${p.slot.end}\n${p.slot.cls} ${p.slot.days}`], ['급수', o.grade], ['이름', name], ['연락처', phone]],
      amount: p.slot.price, note: '결제하면 바로 신청되고, 입력하신 번호로 안내 문자가 가요.' });
    if (yes) pay(o);
  });

  async function pay(o) {
    const btn = $('odSubmit'), label = btn.textContent;
    const fail = t => { st.busy = false; btn.classList.remove('busy'); btn.textContent = label; $('odErr').textContent = t; };
    st.busy = true; btn.classList.add('busy'); btn.textContent = '결제창을 여는 중…';
    let p;
    try {
      p = await post({ action: 'pay_prepare', kind: 'oneday', name: o.name, phone: o.phone, grade: o.grade, slotId: o.slot.id, date: o.day.d,
        clientId: st.cid, test: o.test, agreeRefund: true });
    } catch (e) { return fail('인터넷 연결을 확인하고 다시 눌러주세요.'); }
    if (!p.ok) {
      if (p.error === 'closed') { st.slot = null; load(); sum(); }
      return fail(p.message || ERR[p.error] || '결제를 시작하지 못했어요. 잠시 뒤 다시 눌러주세요.');
    }
    if (!p.enabled) return fail(`지금은 온라인 원데이 신청을 받지 않아요. ${CFG.phone}로 연락 주세요.`);
    try { await (p.pg === 'npg' ? loadNpg() : loadSdk()); } catch (e) { return fail('결제창을 불러오지 못했어요. 잠시 뒤 다시 눌러주세요.'); }
    stash({ no: String(p.orderId || '').split('-')[0], orderId: p.orderId, phone: o.phone, name: o.name, test: o.test, amount: p.amount,
      when: `${o.day.label} ${o.slot.time}~${o.slot.end}`, cls: `${o.slot.cls} ${o.slot.days}` });
    payWindow(p, o, why => {
      post({ action: 'pay_cancel', kind: 'oneday', orderId: p.orderId, phone: o.phone }).catch(() => {});
      fail(`결제가 완료되지 않았어요${why ? ` (${why})` : ''}. 다시 눌러 결제할 수 있어요.`);
    });
    setTimeout(() => { if (st.busy) { st.busy = false; btn.classList.remove('busy'); btn.textContent = label; } }, 8000);
  }

  /* ---------- 결제 결과 (?pay=ok|fail&no=OD…&msg=) ---------- */
  function payResult() {
    const q = new URLSearchParams(location.search);
    const res = q.get('pay');
    if (res !== 'ok' && res !== 'fail') return false;
    const no = /^OD[0-9A-F]{12}$/.test(q.get('no') || '') ? q.get('no') : '';
    const m = q.get('msg') || '';
    ['pay', 'no', 'msg'].forEach(k => q.delete(k));
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    const s = stashed();
    const mine = s && no && s.no === no ? s : null;
    const box = $('odDone');
    $('odWrap').hidden = true;
    box.hidden = false;
    const back = '<div class="acts"><a class="pri" href="badminton.html">배드민턴 페이지로</a></div>';
    if (res === 'ok') {
      stash(null);
      // 문구는 손님 알림톡(관리프로그램 oneday_paid — 2026-11-11 센터 문구)과 같은 결로
      const rows = [...(mine ? [['수업 일시', mine.when.replace('–', '~')], ['수업', mine.cls]] : []),
        ['장소', '퍼블릭 가산 A동 2층 E HALL'], ['준비물', '개인 라켓과 실내용 배드민턴화'], ...(mine ? [['결제 금액', won(mine.amount)]] : [])];
      const to = mine ? `입력하신 번호(${window.PAYUI.maskPhone(mine.phone)})` : '입력하신 번호';
      box.innerHTML = window.PAYUI.done({ title: mine && mine.test ? '결제가 끝났어요' : '원데이 레슨 신청이 확정됐어요! 🏸', sub: '결제가 끝났어요.',
        rows: [...rows, ...(no ? [['신청번호', no]] : [])],
        steps: [`${to}로 확정 안내(카카오톡 또는 문자)를 보내드려요.`,
          '수업은 코치 1명과 회원 3명이 함께하는 1:3 레슨으로, 1시간 진행돼요.',
          '수업 시작 15분 전에 도착해 실내화로 갈아신고 가볍게 몸을 풀어주세요.',
          '수업이 끝나면 다음 타임 회원분들이 바로 이용할 수 있도록 사용한 셔틀콕(헌볼)을 모으고 코트 바닥 정리도 함께 부탁드려요.'],
        foot: `그럼 코트에서 뵙겠습니다! 😊\n안내가 오지 않거나 일정을 바꾸려면 ${CFG.phone}로 연락 주세요.` }) + back;
    } else {
      const why = payMsgOk(m) ? m : '결제가 완료되지 않았어요.';
      const unknown = m === PAY_UNKNOWN;
      box.innerHTML = `<div class="ok">!</div><h2>${unknown ? '결제 결과를 확인하고 있어요' : '결제가 완료되지 않았어요'}</h2>
        <p>${esc(why)}${unknown ? '' : ' 결제가 끝나야 신청이 접수돼요.'}</p>
        <div class="acts">${unknown ? '' : `<a class="pri" href="${esc(location.pathname + location.search)}">다시 신청하기</a>`}<a href="tel:${esc(CFG.phone)}">전화 ${esc(CFG.phone)}</a></div>`;
      if (mine && !unknown) post({ action: 'pay_cancel', kind: 'oneday', orderId: mine.orderId, phone: mine.phone }).catch(() => {});
    }
    box.scrollIntoView({ block: 'start' });
    return true;
  }
  payResult();
})();
