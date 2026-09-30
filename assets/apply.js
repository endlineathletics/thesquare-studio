/* 수강신청 폼 — badminton-apply.html / yoga-apply.html 공용
   body[data-apply] 가 'badminton' | 'yoga' */
(function () {
  const form = document.getElementById('applyForm');
  if (!form) return;
  const TYPE = document.body.dataset.apply;
  const TYPE_NAME = TYPE === 'badminton' ? '배드민턴' : '요가';
  const CFG = window.APPLY || {};
  const DAYS = ['월', '화', '수', '목', '금'];
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

    $('prefGroups').innerHTML = list.map(g => {
      const cat = window.BD_CATS[g.key];
      const first = g.times[0].split('~')[0], last = g.times[g.times.length - 1].split('~')[1];
      return `<label style="--c:${cat.c};--bg:${cat.bg}"><input type="radio" name="cls" value="${g.key}">
        <span class="grp-card"><b>${esc(g.cls)}</b><span class="d">${g.dayLabel}</span>
        <span class="t">${first} – ${last} · ${g.times.length}타임</span>
        <span class="c">코치 ${esc(g.coaches.join(' · '))}</span><span class="p">${esc(cat.price || '')}</span></span></label>`;
    }).join('');

    const chip = (name, v) => `<label><input type="radio" name="${name}" value="${esc(v)}"${v === '상관없음' ? ' checked' : ''}><span>${esc(v)}</span></label>`;
    form.addEventListener('change', e => {
      if (e.target.name !== 'cls') return;
      const g = groups[e.target.value];
      $('prefTimes').innerHTML = ['상관없음', ...g.times].map(v => chip('time', v)).join('');
      $('prefCoach').innerHTML = ['상관없음', ...g.coaches].map(v => chip('coach', v)).join('');
      $('prefSub').hidden = false;
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

  function yogaPref() {
    const classes = [];
    window.YOGA_SCHEDULE.forEach(s => {
      if (!s.cells) return;
      s.cells.forEach((c, i) => {
        if (!c || c === 'R') return;
        classes.push({ id: `${i}-${s.time}`, dayIndex: i, day: DAYS[i], time: `${s.time}~${s.end}`, class: c[0], teacher: c[1], cat: window.yogaCat(c[0]) });
      });
    });
    const picked = new Set();
    let day = Math.min(Math.max(new Date().getDay() - 1, 0), 4);

    $('prefDays').innerHTML = DAYS.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="false">${d}<i hidden></i></button>`).join('');
    function renderDays() {   // 버튼은 그대로 두고 상태만 갱신 (키보드 포커스 유지)
      $('prefDays').querySelectorAll('button').forEach(b => {
        const i = +b.dataset.d, n = classes.filter(c => c.dayIndex === i && picked.has(c.id)).length;
        b.classList.toggle('on', i === day);
        b.setAttribute('aria-pressed', String(i === day));
        const badge = b.querySelector('i');
        badge.hidden = !n; badge.textContent = n || '';
      });
    }
    function renderList() {
      const list = classes.filter(c => c.dayIndex === day);
      $('prefList').innerHTML = list.length ? list.map(c => {
        const cat = window.YOGA_CATS[c.cat];
        return `<label style="--c:${cat.c};--bg:${cat.bg}"><input type="checkbox" value="${c.id}"${picked.has(c.id) ? ' checked' : ''}>
          <span class="yc"><span class="tm">${c.time.split('~')[0]}</span><b>${esc(c.class)}</b><small>${esc(c.teacher)} · ${c.time.replace('~', ' – ')}</small></span></label>`;
      }).join('') : '<p class="none">이 요일에는 수업이 없습니다.</p>';
    }
    $('prefDays').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      day = +b.dataset.d; renderDays(); renderList();
    });
    $('prefList').addEventListener('change', e => {
      if (e.target.checked) picked.add(e.target.value); else picked.delete(e.target.value);
      renderDays(); updateSummary();
    });
    renderDays(); renderList();

    return {
      value() {
        const v = classes.filter(c => picked.has(c.id)).map(({ day, time, class: cls, teacher }) => ({ day, time, class: cls, teacher }));
        return v.length ? v : null;
      },
      text(v) { return v ? v.map(x => `${x.day} ${x.time} ${x.class}(${x.teacher})`).join('\n') : ''; },
    };
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
    if (!v.preference) errs.push('preference');
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
    L.push([TYPE === 'badminton' ? '희망 수업' : '희망 수업', pref.text(v.preference)]);
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
    const payload = { action: 'apply', ...v, clientId: CLIENT_ID, submittedAt: new Date().toISOString(), source: 'homepage' };

    if (!CFG.api) { done(v, null, 'fallback'); return; }

    sending = true;
    const btn = $('applySubmit'); btn.disabled = true; btn.textContent = '접수 중…';
    try {
      const res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      const r = await res.json();
      if (!r.ok) throw new Error(r.error || 'fail');
      done(v, r.id, 'ok');
    } catch (err) {
      $('applyErr').textContent = `접수 중 오류가 발생했습니다. 잠시 후 다시 시도하시거나 ${CFG.phone}로 문의해주세요.`;
      btn.disabled = false; btn.textContent = '수강신청 완료하기';
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
      ? (CFG.alimtalk ? `입력하신 번호(${esc(v.phone)})로 접수 완료 알림톡이 발송됩니다.<br>확인 후 담당자가 연락드리겠습니다.`
                      : `확인 후 담당자가 ${esc(v.phone)}로 연락드리겠습니다.`)
      : `아래 신청 내용을 복사해 인스타그램 DM으로 보내주시거나<br>${esc(CFG.phone)}로 전화 주시면 바로 접수해드립니다.`;
    box.innerHTML = `<div class="ok">${mode === 'ok' ? '✓' : '!'}</div>
      <h2>${mode === 'ok' ? '수강신청이 접수되었습니다' : '신청 내용을 보내주세요'}</h2>
      <p>${msg}</p>
      <div class="receipt">${esc(text)}</div>
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
  }
})();
