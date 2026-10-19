/* 수강신청 폼 — badminton-apply.html / yoga-apply.html 공용
   body[data-apply] 가 'badminton' | 'yoga' */
(function () {
  const form = document.getElementById('applyForm');
  if (!form) return;
  const TYPE = document.body.dataset.apply;
  const TYPE_NAME = TYPE === 'badminton' ? '배드민턴' : '요가';
  const CFG = Object.assign({}, window.APPLY);
  // phone 은 종목별 { badminton, yoga } 또는 문자열 하나 — 이 페이지 종목의 번호로 정리
  CFG.phone = (CFG.phone && typeof CFG.phone === 'object') ? (CFG.phone[TYPE] || CFG.phone.badminton || '') : (CFG.phone || '');
  const DAYS = ['월', '화', '수', '목', '금'];
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 요가 수강권 종류(가격표를 못 받을 때의 이름) — pref 를 만들기 전에 있어야 함(const 는 끌어올려지지 않음)
  const YOGA_TICKETS = [['trial1', '체험 1회권'], ['trial5', '체험 5회권'], ['pack8', '8회 회원권'], ['pack24', '24회 회원권'],
    ['private1', '프라이빗 1회'], ['private5', '프라이빗 5회']];
  const wonText = n => Number(n).toLocaleString('ko-KR') + '원';
  // 가격 칸 — 할인가(10월 한정 등, 관리프로그램이 regular = 정가를 줄 때)면 정가를 취소선으로 위에 (2026-10-19)
  const priceHtml = x => `${x.regular > x.amount ? `<s>${wonText(x.regular)}</s>` : ''}${wonText(x.amount)}`;

  /* ---------- 연락처 자동 하이픈 ---------- */
  form.phone.addEventListener('input', () => {
    const d = form.phone.value.replace(/\D/g, '').slice(0, 11);
    form.phone.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
  });

  /* ---------- 희망 시간 & 코치/강사 ---------- */
  const pref = TYPE === 'badminton' ? badmintonPref() : yogaPref();

  function badmintonPref() {
    const groups = {};
    window.BD_SCHEDULE.forEach(s => {
      if (!s.cells) return;
      s.cells.forEach((c, i) => {
        if (!c || c === 'R') return;
        const k = c[2];
        const g = groups[k] || (groups[k] = { key: k, cls: c[0], days: [], times: [], coaches: [] });
        if (!g.days.includes(i)) g.days.push(i);
        const t = `${s.time}~${s.end}`;
        if (!g.times.includes(t)) g.times.push(t);
        c[1].split(' · ').forEach(x => { if (!g.coaches.includes(x)) g.coaches.push(x); });
      });
    });
    const list = Object.values(groups);
    list.forEach(g => { g.days.sort(); g.dayLabel = g.days.map(i => DAYS[i]).join('·'); });

    // 타임별 마감 (2026-10-19 사용자 "꽉 찬 반도 마감이라고 안 떠" · "있는 사람이랑 급수가 안 맞으면 마감") — 관리프로그램
    // GET api?action=bd_slots&grade= 가 정원·'붙은 두 급수까지'·입문 3명 조·타임별 받을 급수로 달마다 들어갈 수 있는지 준다.
    // avail[반 key][시작 HH:MM] = [{ym, ok}] (이번 달 남은 수업 → 다음 달 순). 못 받으면 {} — 마감 표시 없이 예전처럼(결제 화면이 다시 막음)
    let avail = {}, loadNo = 0;
    // 첫 달(이번 달 남은 수업, 없으면 다음 달)이 마감이면 그 타임은 마감 — '11월부터' 같은 건 없음(2026-10-19 사용자 "11월에 재결제할 수도
    // 있어서 마감인 건 신청 절대 못 해" — 관리프로그램도 이번 달이 마감이면 다음 달을 막음)
    const slotState = (k, t) => {               // '' 모름 · 'ok' · 'full'
      const ms = (avail[k] || {})[t.split('~')[0]];
      if (!ms || !ms.length) return '';
      return ms[0].ok ? 'ok' : 'full';
    };
    const classFull = g => g.times.every(t => slotState(g.key, t) === 'full');

    function drawCards() {
      const cur = form.cls && form.cls.value;
      $('prefGroups').innerHTML = list.map(g => {
        const cat = window.BD_CATS[g.key], full = classFull(g);
        const first = g.times[0].split('~')[0], last = g.times[g.times.length - 1].split('~')[1];
        return `<label style="--c:${cat.c};--bg:${cat.bg}"${full ? ' class="off"' : ''}><input type="radio" name="cls" value="${g.key}"${cur === g.key && !full ? ' checked' : ''}${full ? ' disabled' : ''}>
          <span class="grp-card">${full ? '<em class="full">마감</em>' : ''}<b>${esc(g.cls)}</b><span class="d">${g.dayLabel}</span>
          <span class="t">${first} – ${last} · ${g.times.length}타임</span>
          <span class="c">코치 ${esc(g.coaches.join(' · '))}</span><span class="p">${esc(cat.price || '')}</span></span></label>`;
      }).join('');
    }

    const chip = (name, v, st, on) => {
      const off = st === 'full', note = off ? '마감' : '';
      return `<label${off ? ' class="off"' : ''}><input type="radio" name="${name}" value="${esc(v)}"${on ? ' checked' : ''}${off ? ' disabled' : ''}><span>${esc(v)}${note ? `<small>${note}</small>` : ''}</span></label>`;
    };
    function drawSub() {
      const k = form.cls && form.cls.value, g = k && groups[k];
      if (!g) { $('prefSub').hidden = true; return; }
      const curT = (form.time && form.time.value) || '상관없음', curC = (form.coach && form.coach.value) || '상관없음';
      const tState = t => t === '상관없음' ? (classFull(g) ? 'full' : '') : slotState(k, t);
      const okT = tState(curT) === 'full' ? '상관없음' : curT;    // 급수를 바꿔 고른 시간이 마감되면 '상관없음'으로
      $('prefTimes').innerHTML = ['상관없음', ...g.times].map(v => chip('time', v, tState(v), v === okT)).join('');
      $('prefCoach').innerHTML = ['상관없음', ...g.coaches].map(v => chip('coach', v, '', v === curC)).join('');
      $('prefSub').hidden = false;
    }
    function loadAvail() {
      if (!CFG.api) return;
      const no = ++loadNo, gr = (form.grade && form.grade.value) || '';
      fetch(CFG.api + '?action=bd_slots' + (gr ? '&grade=' + encodeURIComponent(gr) : '')).then(r => r.json()).then(r => {
        if (no !== loadNo || !r || !r.ok || !Array.isArray(r.slots)) return;
        avail = {};
        r.slots.forEach(s => { (avail[s.key] = avail[s.key] || {})[s.time] = s.months || []; });
        drawCards();
        drawSub();
        updateSummary();
      }).catch(() => { /* 못 받으면 마감 표시 없이 — 결제 화면이 정원·급수를 다시 본다 */ });
    }
    if ($('prefNote')) $('prefNote').innerHTML = '급수를 먼저 고르시면 신청할 수 있는 시간이 열려요. <b>마감</b>은 정원이 찼거나 고르신 급수와 맞지 않는 시간이에요. '
      + `마감된 시간의 <b>대기 신청은 ${esc(CFG.phone)}</b>로 연락 주세요.`;
    drawCards();
    loadAvail();
    form.addEventListener('change', e => {
      if (e.target.name === 'cls') drawSub();
      else if (e.target.name === 'grade') loadAvail();
    });

    return {
      value() {
        const k = form.cls && form.cls.value;
        if (!k) return null;
        const g = groups[k];
        return { classKey: k, class: g.cls, days: g.dayLabel, time: (form.time && form.time.value) || '상관없음', coach: (form.coach && form.coach.value) || '상관없음', price: window.BD_CATS[k].price || '' };
      },
      text(v) { return v ? `${v.class} ${v.days} / ${v.time === '상관없음' ? '시간 무관' : v.time} / 코치 ${v.coach}` : ''; },
    };
  }

  // 요가는 신청서에서 시간·강사를 고르지 않고(2026-10-18 — 수강권 결제 뒤 앱에서 예약) 수강권을 고른다(2026-10-19 — 03 '수업 예약' 칸 대신
  // '수강권 선택'): 관리프로그램 가격표 6종(GET api?action=yoga_tickets — 오늘 가격·한정가 뱃지)을 라디오로, 못 받으면 종류 이름만(가격은 결제 화면에서).
  // 고른 것은 신청서에 ticket 으로 같이 저장되고(관리자 수강신청·수강권 등록에 미리 채워짐) 결제 화면에서 미리 골라진다. preference 는 그대로 빈 목록
  function yogaPref() {
    const box = $('ticketOpts');
    let list = YOGA_TICKETS.map(([key, label]) => ({ key, label, sub: '', amount: null, badge: '' }));
    const draw = () => {
      if (!box) return;
      const cur = (form.ticket && form.ticket.value) || '';
      const had = box.contains(document.activeElement) ? document.activeElement.value : null;   // 가격표가 늦게 와 다시 그릴 때 포커스 유지
      box.innerHTML = list.map(x => `<label class="ap-opt"><input type="radio" name="ticket" value="${esc(x.key)}"${cur === x.key ? ' checked' : ''}>
        <span class="t">${esc(x.label)}${x.badge ? ` <em>${esc(x.badge)}</em>` : ''}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>
        ${x.amount != null ? `<span class="p">${priceHtml(x)}</span>` : ''}</label>`).join('');
      if (had != null) { const i = box.querySelector(`input[value="${had}"]`) || box.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
    };
    draw();
    if (CFG.api && box) {
      fetch(CFG.api + '?action=yoga_tickets').then(r => r.json()).then(r => {
        if (r && r.ok && Array.isArray(r.tickets) && r.tickets.length) { list = r.tickets; draw(); updateSummary(); }
      }).catch(() => { /* 가격표를 못 받으면 종류 이름만 — 가격은 결제 화면에서 */ });
    }
    // 요약·접수 글엔 종류·뱃지만 — 금액은 결제 화면이 그 사람 기준으로 다시 정한다(1회권 구매자 가격·날짜가 바뀌는 밤)
    const text = k => { const x = list.find(t => t.key === k); return x ? `${x.label}${x.badge ? ` (${x.badge})` : ''}` : ''; };
    return { value: () => [], text, ticket: () => (form.ticket && form.ticket.value) || '' };
  }

  /* ---------- 값 수집 & 검증 ---------- */
  const PHONE_RE = /^01[016789]-\d{3,4}-\d{4}$/;
  function collect() {
    const f = form;
    return {
      type: TYPE,
      typeName: TYPE_NAME,
      name: f.name.value.trim(),
      gender: (f.gender.value || ''),
      age: f.age.value ? Number(f.age.value) : null,
      phone: f.phone.value.trim(),
      grade: f.grade ? f.grade.value : undefined,
      experience: f.experience.value,
      preference: pref.value(),
      ticket: TYPE === 'yoga' ? pref.ticket() : undefined,     // 요가 수강권 종류 (2026-10-19)
      region: f.region.value.trim(),
      guardian: isMinor() ? { name: f.gName.value.trim(), relation: f.gRel.value } : null,
      agreements: { privacy: f.agree.checked, notification: f.agree.checked, guardian: isMinor() ? f.gAgree.checked : false },
    };
  }
  /* 만 14세 미만 → 법정대리인(보호자) 동의 필요 (개인정보 보호법 제22조의2) */
  function isMinor() { const a = Number(form.age.value); return !!form.age.value && a < 14; }
  function syncGuardian() { $('guardianBox').hidden = !isMinor(); }
  form.age.addEventListener('input', syncGuardian);
  syncGuardian();
  function check(v) {
    const errs = [];
    if (!v.name) errs.push('name');
    if (!v.gender) errs.push('gender');
    if (!(v.age >= 3 && v.age <= 99)) errs.push('age');
    if (!PHONE_RE.test(v.phone)) errs.push('phone');
    if (TYPE === 'badminton' && !v.grade) errs.push('grade');
    if (!v.experience) errs.push('experience');
    if (TYPE === 'badminton' && !v.preference) errs.push('preference');
    if (TYPE === 'yoga' && !v.ticket) errs.push('ticket');
    if (!v.region) errs.push('region');
    if (!v.agreements.privacy) errs.push('agree');
    if (v.guardian) {
      if (!v.guardian.name) errs.push('gName');
      if (!v.guardian.relation) errs.push('gRel');
      if (!v.agreements.guardian) errs.push('gAgree');
    }
    return errs;
  }
  function markErrors(errs) {
    form.querySelectorAll('.fld').forEach(el => el.classList.toggle('err', errs.includes(el.dataset.f)));
  }

  /* ---------- 요약 ---------- */
  function lines(v) {
    const L = [
      ['구분', `${TYPE_NAME} 수강신청`],
      ['이름', v.name],
      ['성별 · 나이', [v.gender, v.age ? `만 ${v.age}세` : ''].filter(Boolean).join(' · ')],
      [guardianPhone(v) ? '보호자 연락처' : '연락처', v.phone],
    ];
    if (v.guardian) L.push(['법정대리인', [v.guardian.name, v.guardian.relation].filter(Boolean).join(' · ')]);
    if (TYPE === 'badminton') L.push(['급수', v.grade]);
    L.push(['경력', v.experience]);
    if (TYPE === 'badminton') L.push(['희망 수업', pref.text(v.preference)]);
    if (TYPE === 'yoga') L.push(['수강권', pref.text(v.ticket)]);
    L.push(['거주 지역', v.region]);
    return L;
  }
  function guardianPhone(v) {
    return !!v.guardian || (TYPE === 'badminton' && v.preference && v.preference.class.includes('유소년'));
  }
  function updateSummary() {
    const v = collect();
    $('sumList').innerHTML = lines(v).slice(1).map(([k, val]) =>
      `<dt>${k}</dt><dd class="${val ? '' : 'empty'}">${val ? esc(val).replace(/\n/g, '<br>') : '미입력'}</dd>`).join('');
    if (form.querySelector('.fld.err')) markErrors(check(v));
  }
  form.addEventListener('input', updateSummary);
  form.addEventListener('change', updateSummary);
  updateSummary();

  function receipt(v, id) {
    return [`[THE SQUARE] ${TYPE_NAME} 수강신청 접수`, id ? `신청번호: ${id}` : '', ...lines(v).slice(1).map(([k, val]) => `${k}: ${val}`)]
      .filter(Boolean).join('\n');
  }

  /* ---------- 제출 ---------- */
  // 같은 화면에서 재전송해도 서버가 중복으로 저장하지 않도록 쓰는 요청 ID
  const CLIENT_ID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  let sending = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    $('applyErr').textContent = '';
    const v = collect();
    const errs = check(v);
    markErrors(errs);
    if (errs.length) {
      const first = form.querySelector('.fld.err');
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inp = first.querySelector('input,select'); if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 300);
      return;
    }
    // test = 시험 주소(?paytest=1) — 결제가 켜져 있으면 관리프로그램이 신청서를 '결제 전'으로 받아 결제가 끝나야 신청으로 보여 준다 (2026-10-19)
    const payload = { action: 'apply', ...v, test: isPayTest(), clientId: CLIENT_ID, submittedAt: new Date().toISOString(), source: 'homepage' };

    if (!CFG.api) { done(v, null, 'fallback'); return; }

    sending = true;
    const btn = $('applySubmit'); btn.disabled = true; btn.textContent = '신청하는 중…';
    try {
      const res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      const r = await res.json();
      if (!r.ok) throw new Error(r.error || 'fail');
      done(v, r.id, 'ok');
    } catch (err) {
      $('applyErr').textContent = `신청 중 오류가 발생했습니다. 잠시 후 다시 시도하시거나 ${CFG.phone}로 문의해주세요.`;
      btn.disabled = false; btn.textContent = '신청하고 결제하기';
    }
    sending = false;
  });

  function copyText(text, el, btn) {
    const ok = () => { btn.textContent = '복사됨 ✓'; };
    const manual = () => {      // 복사 기능이 막힌 브라우저: 내용을 선택해두고 안내
      const r = document.createRange(); r.selectNodeContents(el);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      btn.textContent = '선택된 내용을 길게 눌러 복사해주세요';
    };
    const legacy = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      let done = false; try { done = document.execCommand('copy'); } catch (e) { /* noop */ }
      ta.remove();
      done ? ok() : manual();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, legacy);
    else legacy();
  }

  function done(v, id, mode) {
    const text = receipt(v, id);
    const box = $('applyDone');
    const msg = mode === 'ok'
      ? `아래에서 결제하면 신청과 등록이 끝나요${id ? ` (신청번호 ${esc(id)})` : ''}. 결제 전에는 신청이 접수되지 않아요.`
      : `아래 신청 내용을 복사해 인스타그램 DM으로 보내주시거나<br>${esc(CFG.phone)}로 전화 주시면 바로 접수해드립니다.`;
    box.innerHTML = `<div class="ok">${mode === 'ok' ? '✓' : '!'}</div>
      <h2>${mode === 'ok' ? '신청 내용 확인' : '신청 내용을 보내주세요'}</h2>
      <p id="doneMsg">${msg}</p>
      <div class="receipt">${esc(text)}</div>
      ${mode === 'ok' ? '<div class="ap-pay" id="payBox"></div>' : ''}
      <div class="acts">
        ${mode === 'ok' ? '' : `<button type="button" class="pri" id="copyReceipt">내용 복사</button>
        <a href="${esc(CFG.instagram)}" target="_blank" rel="noopener">인스타그램 DM</a>
        <a href="tel:${esc(CFG.phone)}">전화 ${esc(CFG.phone)}</a>`}
        <a href="${TYPE}.html">${TYPE_NAME} 페이지로</a>
      </div>`;
    const cp = $('copyReceipt');
    if (cp) cp.onclick = () => copyText(text, box.querySelector('.receipt'), cp);
    $('applyWrap').hidden = true;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (mode === 'ok' && id) {
      const what = TYPE === 'badminton' && v.preference ? `${v.preference.class} ${v.preference.days}` : '';
      payBox($('payBox'), { id, phone: v.phone, name: v.name, test: isPayTest(), what, pick: v.ticket || '' });
    }
  }

  /* ---------- 온라인 결제 (2026-10 — 관리프로그램 api 'pay_options' → 'pay_prepare' → 나이스페이 결제창) ----------
     신청서 저장(apply) 뒤 확인 화면에서, 고를 것(배드민턴: 시작 달·시간 / 요가: 수강권)과 금액을 서버에서 받아 보여 주고 [결제하기].
     결제가 끝나면 나이스페이가 관리프로그램으로 보내고, 관리프로그램이 이 화면(?pay=ok|fail&no=신청번호)으로 돌려보낸다 → payResult.
     결제가 꺼져 있으면(관리자 설정·키 — 응답 enabled:false) 옛 동작 '확인 후 담당자가 연락'. 금액·주문번호는 서버가 정하고 여기선 보여 주기만.
     ?paytest=1 = 시험 주소(관리자가 '수강 온라인 결제'를 켜기 전 시험 — 운영이면 진짜 결제·진짜 등록이라 시험 뒤 환불) */
  const PAY_KEY = 'apPay';   // sessionStorage — 결제창으로 넘어간 신청 { id, phone, name, test, orderId } (돌아와서 다시 결제·결과 확인)
  // ?msg= 는 누구나 주소에 적을 수 있어서 관리프로그램 PAY_MSG 와 같은 문구만 보여준다 (그 밖의 글은 버림)
  const PAY_MSGS = ['결제가 완료되지 않았어요.', '결제가 취소됐거나 인증되지 않았어요.', '이미 끝났거나 취소된 결제예요.',
    '신청 내용이 바뀌어 결제하지 않았어요.', '카드 승인이 되지 않았어요.', '결제 승인 중 연결이 끊겨 결제를 취소했어요.',
    '결제 결과를 확인하고 있어요. 결과는 문자로 알려드릴게요.', '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.'];
  const PAY_UNKNOWN = PAY_MSGS[6];   // 관리프로그램 PAY_MSG.unknown — 실패가 아니라 결과 대기 (다시 결제하게 하지 않음)
  const payMsgOk = m => PAY_MSGS.includes(m) || /^결제 시간\(\d{1,3}분\)이 지났어요\.$/.test(m);
  const PAY_ERR = {
    full: '방금 마감됐어요. 다른 것을 골라주세요.', already_registered: '이미 그 달 그 시간에 등록돼 있어요. 앱에서 결제해 주세요.', bad_option: '고를 수 있는 것이 바뀌었어요. 화면을 새로 고쳐주세요.',
    already_paid: '이미 결제가 끝났어요.', in_progress: '결제를 확인하고 있어요. 잠시 뒤 다시 확인해주세요.',
    not_payable: '이미 등록이 끝났거나 결제할 수 없는 신청이에요.', not_found: '결제할 수 있는 시간이 지났어요. 신청은 접수됐으니 담당자가 연락드릴게요.',
  };
  const isPayTest = () => new URLSearchParams(location.search).get('paytest') === '1';
  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  let sdk = null;

  /** 관리프로그램 /api/site POST → 응답 JSON (오류 응답 4xx 도 JSON 이라 그대로 읽음, 연결 실패는 throw) */
  async function post(body) {
    const res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return res.json();
  }
  function stash(v) {
    try { if (v) sessionStorage.setItem(PAY_KEY, JSON.stringify(v)); else sessionStorage.removeItem(PAY_KEY); } catch (e) { /* 못 써도 결제는 그대로 */ }
  }
  function stashed() {
    try { const v = JSON.parse(sessionStorage.getItem(PAY_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
  }
  /** UTF-8 n바이트 안으로 자름 (나이스페이 길이 규칙이 byte) */
  function cutBytes(s, n) {
    let out = '', len = 0;
    for (const ch of String(s || '')) {
      const p = ch.codePointAt(0), b = p < 0x80 ? 1 : p < 0x800 ? 2 : p < 0x10000 ? 3 : 4;
      if (len + b > n) break;
      out += ch; len += b;
    }
    return out;
  }
  function loadSdk() {
    if (window.AUTHNICE) return Promise.resolve();
    if (!CFG.paySdk) return Promise.reject(new Error('no_sdk'));
    if (!sdk) {
      sdk = new Promise((ok, no) => {
        const s = document.createElement('script');
        const t = setTimeout(() => no(new Error('sdk_timeout')), 20000);
        s.src = CFG.paySdk; s.async = true;
        s.onload = () => { clearTimeout(t); if (window.AUTHNICE) ok(); else no(new Error('no_authnice')); };
        s.onerror = () => { clearTimeout(t); s.remove(); no(new Error('sdk_load')); };
        document.head.appendChild(s);
      }).catch(err => { sdk = null; throw err; });
    }
    return sdk;
  }

  /** 서버가 준 안내 글(message — 예: 체험권 제한 이유)이 있으면 그 글, 없으면 오류 코드별 문구 (2026-10-18 — [1/6] 체험권 제한과 맞춘 자리) */
  const errText = (r, dflt) => (r && typeof r.message === 'string' && r.message.trim()) ? r.message.trim().slice(0, 200) : (PAY_ERR[r && r.error] || dflt);
  /** 고른 것 한 줄 — '8회 회원권 (10월 한정)\n8회 · 결제일부터 30일' / '19:30~20:30 · 11월\n한 달 · 8회' */
  const optText = x => `${x.time ? x.time + ' · ' : ''}${x.label}${x.badge ? ` (${x.badge})` : ''}${x.sub ? '\n' + x.sub : ''}`;
  /** 옵션 아래 글 — 서버가 못 사는 까닭(why — 체험권 1인 1번 등, 관리프로그램 apply_pay_options)을 주면 빨간 글로 (sub 에도 같은 글이 와서 한 번만) */
  const optSub = x => {
    const why = x.disabled && (x.why || x.reason);
    return `${!why || x.sub !== why ? `<small>${esc(x.sub)}</small>` : ''}${why ? `<span class="why">${esc(why)}</span>` : ''}`;
  };
  const appLogin = () => { try { return new URL(CFG.api).origin + '/login'; } catch (e) { return ''; } };

  /** 결제 칸 그리기 — o = { id: 신청번호, phone, name, test, what(배드민턴 반 이름), pick(요가 — 신청서에서 고른 수강권 key) }
      고르기 → 환불 규정 체크(PAYUI.terms — 체크해야 버튼이 켜짐) → [N원 결제하기] → 확인창(종목·수강권·금액·이름·연락처) → 결제창.
      요가는 신청서에서 고른 수강권(o.pick, 없으면 서버가 저장해 둔 r.picked)을 다시 고르게 하지 않고 그것만 보여 준다(2026-10-19 사용자 "신청 누르면
      수강권 선택이 다시 나와서 없애줘") — 고른 게 없거나(옛 신청서) 그 사람이 살 수 없는 것(체험권 1인 1번)이면 예전처럼 목록 + 고를 수 있는 첫 것 */
  async function payBox(box, o) {
    if (!box) return;
    box.innerHTML = '<p class="ap-pay-msg">결제 정보를 불러오는 중…</p>';
    let r = null;
    try { r = await post({ action: 'pay_options', kind: 'apply', id: o.id, phone: o.phone, test: o.test }); } catch (e) { /* 아래 */ }
    const closed = t => {                       // 살 수 있는 게 없음(마감 등) — 결제를 못 하니 신청도 아님 (2026-10-19, 담당자 연락 없음)
      box.innerHTML = `<p class="ap-pay-msg">${t}</p>`;
      if ($('doneMsg')) $('doneMsg').textContent = '선택한 시간이 마감돼 신청이 접수되지 않았어요.';
    };
    const say = t => {                          // 결제가 없으면 위 '결제하면 신청과 등록이 끝나요' 줄도 접수 안내로 바꾼다 (관리프로그램이 신청서를 드러냄)
      box.innerHTML = `<p class="ap-pay-msg">${t}</p>`;
      if ($('doneMsg')) $('doneMsg').textContent = `신청이 접수됐어요${o.id ? ` (신청번호 ${o.id})` : ''}.`;
    };
    if (!r) {                                   // 연결 실패 — 신청서는 '결제 전'이라 아직 접수가 아님 (2026-10-19), 다시 열면 결제 칸이 다시 뜸
      box.innerHTML = `<p class="ap-pay-msg">결제 정보를 불러오지 못했어요. 잠시 뒤 이 화면을 새로 고치거나 ${esc(CFG.phone)}로 연락 주세요.</p>`;
      return;
    }
    if (r.error === 'bad_request') {            // 결제 기능 전의 관리프로그램
      return say(`신청은 접수됐어요. 확인 후 담당자가 ${esc(o.phone)}로 연락드리겠습니다.`);
    }
    if (r.ok && !r.enabled) return say(`신청은 접수됐어요. 확인 후 담당자가 ${esc(o.phone)}로 연락드리겠습니다.`);
    if (!r.ok) return say(esc(r.error === 'already_paid' && r.test ? '테스트 결제가 이미 끝났어요 (실제 결제·등록은 안 됨).' : errText(r, '결제 정보를 불러오지 못했어요. 담당자가 연락드릴게요.')));
    if (!r.options.length) return closed(esc(r.note || `지금은 신청할 수 없어요. 문의는 ${CFG.phone}로 연락 주세요.`));
    const pick = o.pick || r.picked || '';
    const picked = pick ? r.options.find(x => x.key === pick) : null;
    const first = (picked && !picked.disabled) ? picked : r.options.find(x => !x.disabled);
    const fixed = TYPE === 'yoga' && picked && !picked.disabled;   // 신청서에서 고른 수강권 그대로
    const times = new Set(r.options.map(x => x.time).filter(Boolean)).size > 1;
    const optBody = x => `<span class="t">${times && x.time ? `<b class="tm">${esc(x.time)}</b> ` : ''}${esc(x.label)}${x.badge ? ` <em>${esc(x.badge)}</em>` : ''}${optSub(x)}</span>
          <span class="p">${priceHtml(x)}</span>`;
    box.innerHTML = `<h3>${fixed ? '결제할 수강권' : TYPE === 'yoga' ? '수강권을 골라주세요' : '시작할 달을 골라주세요'}</h3>
      ${fixed ? `<div class="ap-opt fixed">${optBody(first)}</div>` : `<div class="ap-opts" role="radiogroup">${r.options.map(x => `
        <label class="ap-opt${x.disabled ? ' off' : ''}"><input type="radio" name="payopt" value="${esc(x.key)}"${x === first ? ' checked' : ''}${x.disabled ? ' disabled' : ''}>
          ${optBody(x)}</label>`).join('')}</div>`}
      ${picked && picked.disabled ? `<p class="ap-pay-msg err" role="alert">신청서에서 고른 ${esc(picked.label)}은 지금 살 수 없어요 — 다른 수강권을 골라 주세요.</p>` : ''}
      ${r.note ? `<p class="ap-pay-note">${esc(r.note)}</p>` : ''}
      ${first ? '<div id="payTerms"></div>' : ''}
      ${first ? `<button type="button" class="ap-paybtn" id="payGo" disabled>${won(first.amount)} 결제하기</button>
        <p class="ap-pay-hint" id="payHint">환불 규정에 동의하면 결제할 수 있어요.</p>` : `<p class="ap-pay-msg">지금은 모두 마감이에요. 대기 신청은 ${esc(CFG.phone)}로 연락 주세요.</p>`}
      <p class="ap-pay-msg err" id="payMsg" role="alert"></p>
      ${r.mode !== 'live' ? '<p class="ap-pay-note">테스트 결제창이에요 — 실제로 돈이 나가지 않고 등록되지 않아요.</p>'
        : (o.test ? '<p class="ap-pay-note">시험 주소예요 — 실제로 결제되고 등록돼요.</p>' : '')}`;
    const go = box.querySelector('#payGo');
    if (!go) {                                  // 모두 마감 — 결제를 못 하니 신청도 아님(관리프로그램은 결제 전 신청서를 24시간 뒤 지움), 대기는 전화
      if ($('doneMsg')) $('doneMsg').textContent = '선택한 시간이 마감돼 신청이 접수되지 않았어요.';
      return;
    }
    const st = { busy: false, agreed: false };
    const sync = () => {                        // 버튼: 동의해야 켜짐, 결제 준비 중엔 꺼짐
      go.disabled = st.busy || !st.agreed;
      box.querySelector('#payHint').hidden = st.agreed;
    };
    st.terms = window.PAYUI.terms(box.querySelector('#payTerms'), { api: CFG.api, key: 'refund_class', phone: CFG.phone,
      onChange: ok => { st.agreed = ok; sync(); } });
    box.querySelectorAll('input[name=payopt]').forEach(i => i.addEventListener('change', () => {
      const x = r.options.find(y => y.key === i.value);
      if (x && !st.busy) go.textContent = `${won(x.amount)} 결제하기`;
    }));
    go.onclick = async () => {
      const sel = box.querySelector('input[name=payopt]:checked');
      const x = fixed ? first : sel && r.options.find(y => y.key === sel.value);
      if (!x || st.busy || !st.terms.ok()) return;
      const yes = await window.PAYUI.confirm({
        title: '결제 전에 확인해 주세요',
        rows: [['종목', TYPE_NAME + (o.what ? ` · ${o.what}` : '')], [TYPE === 'yoga' ? '수강권' : '수강', optText(x)],
          ['이름', o.name], ['연락처', o.phone]],
        amount: x.amount,
        note: r.mode !== 'live' ? '테스트 결제창이 열려요 — 실제로 돈이 나가지 않아요.' : '결제하면 바로 등록되고, 입력하신 번호로 안내 문자가 가요.',
      });
      if (yes) startPay(box, o, go, x, st, sync);
    };
  }

  async function startPay(box, o, go, x, st, sync) {
    const msg = box.querySelector('#payMsg');
    const label = `${won(x.amount)} 결제하기`;
    const fail = t => { st.busy = false; go.classList.remove('busy'); go.textContent = label; sync(); msg.textContent = t; };
    st.busy = true; go.classList.add('busy'); sync(); go.textContent = '결제창을 여는 중…'; msg.textContent = '';
    let p;
    try { p = await post({ action: 'pay_prepare', kind: 'apply', id: o.id, phone: o.phone, test: o.test, option: x.key, agreeRefund: st.terms.ok() }); }
    catch (e) { return fail('인터넷 연결을 확인하고 다시 눌러주세요.'); }
    if (!p.ok) return fail(errText(p, '결제를 시작하지 못했어요. 잠시 뒤 다시 눌러주세요.'));
    if (!p.enabled) return fail('지금은 온라인 결제를 받지 않아요. 담당자가 연락드릴게요.');
    try { await loadSdk(); } catch (e) { return fail('결제창을 불러오지 못했어요. 잠시 뒤 다시 눌러주세요.'); }
    // 결제 완료 화면이 '무엇을 · 얼마에'를 보여 주게 고른 것도 남김 (같은 브라우저로 돌아올 때만 — 개인정보는 이 기기 sessionStorage 에만)
    stash({ id: o.id, phone: o.phone, name: o.name, test: o.test, orderId: p.orderId, at: Date.now(), what: o.what || '', pick: x.key,
      item: { text: optText(x), amount: p.amount } });
    window.AUTHNICE.requestPay({
      clientId: p.clientId, method: CFG.payMethod || 'card', orderId: p.orderId, amount: p.amount, goodsName: p.goodsName,
      returnUrl: p.returnUrl, buyerName: cutBytes(o.name, 30), buyerTel: String(o.phone || '').replace(/\D/g, ''),
      fnError: res => {
        post({ action: 'pay_cancel', kind: 'apply', id: o.id, phone: o.phone, orderId: p.orderId }).catch(() => {});
        const why = res && (res.errorMsg || res.msg);
        fail(`결제가 완료되지 않았어요${why ? ` (${why})` : ''}. 다시 눌러 결제할 수 있어요.`);
      },
    });
    setTimeout(() => { if (st.busy) { st.busy = false; go.classList.remove('busy'); go.textContent = label; sync(); } }, 8000);   // PC: 결제창(레이어)을 그냥 닫았을 때 다시 누를 수 있게
  }

  /** 결제 완료 화면 — 무엇을 · 얼마에 · 다음 할 일(입력한 번호로 결제 확인 + 첫 등록이면 앱 로그인 링크 문자 — 관리프로그램 on_first_payment) */
  function paidView(no, mine) {
    const rows = [['종목', TYPE_NAME + (mine && mine.what ? ` · ${mine.what}` : '')]];
    if (mine && mine.item) rows.push([TYPE === 'yoga' ? '수강권' : '수강', mine.item.text], ['결제 금액', won(mine.item.amount)]);
    if (no) rows.push(['신청번호', no]);
    const to = mine && mine.phone ? `입력하신 번호(${window.PAYUI.maskPhone(mine.phone)})` : '입력하신 번호';
    const steps = [`${to}로 결제 확인 문자(카카오톡 또는 문자)를 보내드려요. 처음 등록하셨다면 앱 로그인 링크도 같이 가요.`,
      '문자의 링크를 누르면 아이디·비밀번호 없이 바로 앱에 들어가요.',
      TYPE === 'yoga' ? '앱의 [요가 예약]에서 듣고 싶은 수업을 골라 예약하세요. 예약·취소는 수업 3시간 전까지예요.'
        : '앱에서 수업일·출석과 다음 달 재등록을 확인할 수 있어요.'];
    const login = appLogin();
    return window.PAYUI.done({ title: '결제가 완료됐어요', sub: '등록이 끝났어요.', rows, steps,
      foot: `문자가 오지 않으면 ${CFG.phone}로 연락 주세요.` })
      + `<div class="acts">${login ? `<a href="${esc(login)}" target="_blank" rel="noopener">이미 앱을 쓰고 있다면 · 앱 열기</a>` : ''}
        <a class="pri" href="${TYPE}.html">${TYPE_NAME} 페이지로</a></div>`;
  }

  /** 결제를 마치고 돌아온 주소(?pay=ok|fail&no=신청번호&msg=) → 결과 화면 + 주소에서 pay·no·msg 를 뗌 (paytest 는 그대로) */
  function payResult() {
    const q = new URLSearchParams(location.search);
    const st = q.get('pay');
    if (st !== 'ok' && st !== 'fail') return;
    const no = /^AP\d{6}-\d{3,6}$/.test(q.get('no') || '') ? q.get('no') : '';
    const m = q.get('msg') || '';
    ['pay', 'no', 'msg'].forEach(k => q.delete(k));
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    const s = stashed();
    const mine = s && no && s.id === no ? s : null;
    const box = $('applyDone');
    $('applyWrap').hidden = true;
    box.hidden = false;
    const back = `<a href="${TYPE}.html">${TYPE_NAME} 페이지로</a>`;
    if (st === 'ok') {
      stash(null);
      box.innerHTML = paidView(no, mine);
      if (mine) {                               // 샌드박스 시험 결제면 등록되지 않는다 — 서버에 물어 안내를 바꿈
        post({ action: 'pay_options', kind: 'apply', id: mine.id, phone: mine.phone, test: mine.test }).then(r => {
          if (r && r.error === 'already_paid' && r.test) {
            box.innerHTML = window.PAYUI.done({ title: '테스트 결제가 끝났어요', sub: '샌드박스라 실제 결제·등록은 되지 않았어요.',
              rows: [['종목', TYPE_NAME], ...(mine.item ? [[TYPE === 'yoga' ? '수강권' : '수강', mine.item.text], ['금액', won(mine.item.amount)]] : []),
                ['신청번호', no]] }) + `<div class="acts"><a class="pri" href="${TYPE}.html">${TYPE_NAME} 페이지로</a></div>`;
          }
        }).catch(() => {});
      }
      box.scrollIntoView({ block: 'start' });
      return;
    }
    const why = payMsgOk(m) ? m : '결제가 완료되지 않았어요.';
    const unknown = m === PAY_UNKNOWN;
    box.innerHTML = `<div class="ok">!</div><h2>${unknown ? '결제 결과를 확인하고 있어요' : '결제가 완료되지 않았어요'}</h2>
      <p>${esc(why)}${unknown ? '' : ' 결제가 끝나야 신청이 접수돼요 — 아래에서 다시 결제할 수 있어요.'}</p>
      ${mine && !unknown ? '<div class="ap-pay" id="payBox"></div>' : ''}
      <div class="acts"><a href="tel:${esc(CFG.phone)}">전화 ${esc(CFG.phone)}</a>${back}</div>`;
    if (mine && !unknown) {                     // 남은 결제 대기 주문을 닫고(이미 닫혔으면 할 일 없음) 다시 고르게
      post({ action: 'pay_cancel', kind: 'apply', id: mine.id, phone: mine.phone, orderId: mine.orderId }).catch(() => {})
        .finally(() => payBox($('payBox'), mine));
    }
  }
  payResult();
})();
