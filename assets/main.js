(function () {
  /* nav */
  const nav = document.getElementById('nav');
  const top = document.querySelector('.hero, .page-hero');
  const onScroll = () => nav.classList.toggle('solid', !top || window.scrollY > top.offsetHeight - 90);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.getElementById('burger').addEventListener('click', () => nav.classList.toggle('open'));

  /* active menu */
  const page = document.body.dataset.page;
  document.querySelectorAll('#menu a').forEach(a => {
    if (a.dataset.page === page) a.classList.add('on');
  });

  /* 대관 / 레슨 탭: 고른 쪽 구역만 보여줌 (주소 #rental 등으로 들어오면 그 구역이 있는 탭을 염) */
  const tabs = document.getElementById('secTabs');
  if (tabs) {
    const links = [...tabs.querySelectorAll('a[data-tab]')];
    const panes = [...document.querySelectorAll('.tab-pane')];
    const hero = document.querySelector('.page-hero[data-hero]');   // 배드민턴 머리 사진 — 탭마다 다른 사진 (style.css .bd-pic)
    const show = (name, scroll) => {
      panes.forEach(p => { p.hidden = p.dataset.pane !== name; });
      links.forEach(a => a.classList.toggle('on', a.dataset.tab === name));
      if (hero) hero.dataset.hero = name;
      document.body.classList.toggle('has-apply-bar', name !== 'rental');   // 아래 전체 폭 수강신청 막대는 레슨 탭만 — 대관 탭은 자기 예약 막대(.bk2-bar)가 있음
      if (scroll) {   // 탭이 화면 위에 붙어 있을 때만 구역 처음으로 올림
        const y = (top ? top.offsetTop + top.offsetHeight : 0) - (parseFloat(getComputedStyle(tabs).top) || 0);   // 탭이 원래 있던 자리
        if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'instant' });
      }
    };
    links.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      show(a.dataset.tab, true);
      history.replaceState(null, '', a.getAttribute('href'));
    }));
    const fromHash = () => {
      const t = location.hash && document.querySelector(location.hash);
      const p = t && t.closest('.tab-pane');
      show(p ? p.dataset.pane : tabs.dataset.default, false);
      if (p && t) requestAnimationFrame(() => t.scrollIntoView());
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* 사진 줄 옆으로 넘기기 — [data-gallery] 안 .rgal-track + .rgal-btn prev/next (배드민턴 대관 코트 사진, 2026-10-31).
     버튼은 보이는 폭의 80% 만큼 넘기고 scroll-snap 이 사진 앞에 맞춤 · 처음/끝이면 그쪽 버튼 숨김 */
  document.querySelectorAll('[data-gallery]').forEach(g => {
    const track = g.querySelector('.rgal-track'), prev = g.querySelector('.prev'), next = g.querySelector('.next');
    const sync = () => {
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * .8 }));
    next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth * .8 }));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    track.querySelectorAll('img').forEach(i => i.addEventListener('load', sync));
    sync();
  });

  /* reveal */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  /* timetable — 지금 쓰는 페이지 없음(data-timetable 구역 0곳, 옛 요가 시간표는 2026-10-20 삭제) — 배드민턴 표를 다시 넣을 때용
     (페이지에 data-timetable="badminton" 구역 + schedule.js, 모양은 style.css TIMETABLE) */
  const DAYS = ['월', '화', '수', '목', '금'];
  const DAYS_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  // 칸 글(수업 이름·코치)은 HTML 로 넣기 전에 이스케이프
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function clsHTML(cell, cats, catFn) {
    const k = cell[2] || catFn(cell[0], cell);
    const c = cats[k] || { c: '#5b6474', bg: '#eef0f3' };
    return `<div class="cls" data-cat="${esc(k)}" style="--c:${c.c};--bg:${c.bg}"><b>${esc(cell[0])}</b><span>${esc(cell[1])}</span></div>`;
  }
  function timeHTML(s) {
    return `<b>${s.time}</b>${s.end ? (/^\d/.test(s.end) ? '– ' + s.end : s.end) : ''}`;
  }

  function renderTable(el, data, cats, catFn) {
    const nd = data.find(s => s.cells).cells.length;
    let h = '<thead><tr><th class="time"></th>' +
      DAYS.slice(0, nd).map((d, i) => `<th>${d}<small>${DAYS_EN[i]}</small></th>`).join('') + '</tr></thead><tbody>';
    const skip = {}; // "row,col" covered by rowspan
    data.forEach((s, r) => {
      if (s.section) { h += `<tr class="sect"><th colspan="${nd + 1}">${s.section}</th></tr>`; return; }
      h += `<tr><td class="time">${timeHTML(s)}</td>`;
      if (s.band) {
        h += `<td colspan="${nd}" class="band${s.info ? ' info' : ''}">${s.band}${s.note ? `<small>${s.note}</small>` : ''}</td>`;
      } else {
        s.cells.forEach((cell, c) => {
          if (skip[r + ',' + c]) return;
          if (cell === 'R') {
            let span = 1;
            while (data[r + span] && data[r + span].cells && data[r + span].cells[c] === 'R') { skip[(r + span) + ',' + c] = 1; span++; }
            h += `<td class="band" rowspan="${span}">대관</td>`;
          } else if (!cell) {
            h += '<td class="empty"></td>';
          } else {
            h += `<td>${clsHTML(cell, cats, catFn)}</td>`;
          }
        });
      }
      h += '</tr>';
    });
    el.innerHTML = h + '</tbody>';
  }

  function renderDay(el, data, day, cats, catFn) {
    let h = '';
    data.forEach(s => {
      if (s.section) return;
      if (s.band) { h += `<div class="drow"><div class="time">${timeHTML(s)}</div><div class="band${s.info ? ' info' : ''}">${s.band}${s.note ? `<small>${s.note}</small>` : ''}</div></div>`; return; }
      const cell = s.cells[day];
      if (!cell) return;
      h += `<div class="drow"><div class="time">${timeHTML(s)}</div>` +
        (cell === 'R' ? '<div class="band">대관</div>' : clsHTML(cell, cats, catFn)) + '</div>';
    });
    el.innerHTML = h || '<p class="note" style="padding:18px 0">수업이 없습니다.</p>';
  }

  document.querySelectorAll('[data-timetable]').forEach(initTimetable);

  function initTimetable(root) {
    if (root.dataset.timetable !== 'badminton' || !window.BD_SCHEDULE) return;   // 시간표 데이터는 배드민턴(schedule.js)만
    const data = window.BD_SCHEDULE;
    const cats = window.BD_CATS;
    const catFn = window.bdCat;
    const nd = data.find(s => s.cells).cells.length;
    const table = root.querySelector('table');
    const list = root.querySelector('.daylist');
    const tabs = root.querySelector('.daytabs');
    const chips = root.querySelector('.chips');

    renderTable(table, data, cats, catFn);

    let day = Math.min(Math.max(new Date().getDay() - 1, 0), nd - 1);
    tabs.innerHTML = DAYS.slice(0, nd).map((d, i) => `<button type="button" data-d="${i}">${d}</button>`).join('');
    const setDay = d => {
      day = d;
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.d === d));
      renderDay(list, data, d, cats, catFn);
      applyFilter();
    };
    tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setDay(+b.dataset.d); });

    let active = null;
    if (chips) {
      chips.innerHTML = '<button type="button" class="chipbtn on" data-k="">전체</button>' +
        Object.entries(cats).map(([k, c]) => `<button type="button" class="chipbtn" data-k="${esc(k)}"><i style="background:${c.c}"></i>${esc(c.label)}</button>`).join('');
      chips.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        active = b.dataset.k || null;
        chips.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        applyFilter();
      });
    }
    function applyFilter() {
      [table, list].forEach(el => {
        el.classList.toggle('filtering', !!active);
        el.querySelectorAll('.cls').forEach(c => c.classList.toggle('hit', c.dataset.cat === active));
      });
    }
    setDay(day);
  }
})();

/* ---------- 레슨 시간표 창 (2026-11-27) ----------
   badminton.html 레슨 시간표(table.lt)의 칸(.lt-b)을 누르면 그 타임 코치 사진·이력 + 반 설명 + [레슨 등록][원데이 신청] 창(#ltPop, style.css .lp-*).
   반 설명·코치 이력은 여기 CL · CO 에 — 반 소개(badminton.html .lc)·강사진 소개와 같은 글이니 바꿀 땐 같이 고친다.
   사진 없는 코치는 이름 첫 글자 칸. */
(function () {
  const tb = document.querySelector('table.lt'), bg = document.getElementById('ltPop');
  if (!tb || !bg) return;
  const pop = bg.querySelector('.lp');
  const CO = {
    '김동욱': ['김동욱 헤드코치', 'kim-dongwook.jpg?v=4', ['국가대표 후보선수 출신', '前 YONEX 선수단', '前 국군체육부대(상무) 선수단']],
    '김민지': ['김민지 코치', 'kim-minji.jpg?v=5', ['배드민턴 국가대표 (4년, 복식 전공)', '김천시청 배드민턴 선수 (2018~2025)', '2025 스코틀랜드 · 아일랜드 오픈 여자복식 1위']],
    '이동찬': ['이동찬 코치', 'lee-dongchan.jpg?v=4', ['배드민턴 주니어 국가대표 출신', '한국체육대학교 체육학과 졸업', '전국소년체육대회 단체전 1위']],
    '이동혁': ['이동혁 코치', 'lee-donghyeok.jpg?v=4', ['前 일본 Nagai Badminton Team 선수', '이천제일고등학교 졸업', '이천중학교 졸업']],
    '김현규': ['김현규 코치', 'kim-hyungyu.jpg?v=5', ['前 광주은행 선수 (2020~2022)', '前 당진시청 선수 (2023)', '前 제주특별자치도청 선수 (2024)']],
    '이동욱': ['이동욱 코치', 'lee-dongwook.jpg?v=1', ['前 피엠큐민턴 센터장', '前 랫민턴 파크프레온점 코치', '前 에이원민턴 하남미사점 코치']],
    '김나영': ['김나영 코치', 'kim-nayoung.jpg?v=1', ['前 국가대표', '전문2급 지도자 자격증', '회장기 전국 실업배드민턴대회 개인단식 1위 (2023)']],
    '이슬': ['이슬 코치', '', ['現 무한 아카데미 코치', '2026 경인일보배 혼복 준자강 우승', '2026 평창배 여복 준자강 우승']],
    '권이구': ['권이구 코치', '', ['前 국가대표', '남자복식 세계랭킹 11위', '前 G스포츠클럽 코치']],
  };
  const W = '일주일에 하루라도 꾸준히 배우고 싶은 분들을 위한 수업입니다. 기본기와 실전 감각을 차근차근 쌓아갑니다.';
  const AE = '오전 10:00–13:00 · 저녁 18:30–22:30';
  const CL = {
    gen: ['ADULT · REGULAR', '성인 일반반', '수준에 맞는 기본기부터 복식 실전까지, 단계별로 실력을 쌓는 수업입니다. 올바른 자세와 풋워크, 경기에서 활용할 수 있는 기술을 배웁니다.', '<b>월·수</b> 또는 <b>화·목</b> · 주 2회 (월 8회)', AE, '오전 <b>월 25만원</b> · 저녁 <b>월 35만원</b>'],
    one: ['ADULT · ONCE A WEEK', '성인 주 1회반', W, '<b>금요일</b> · 주 1회 (월 4회)', AE, '오전 <b>월 20만원</b> · 저녁 <b>월 25만원</b>'],
    prv: ['ADULT · PRIVATE', '성인 프라이빗반', '3인 소수정예로 자세 교정과 개인별 약점 보완에 집중합니다. 각자의 수준과 목표에 맞춰 세심하게 지도합니다.', '오전 <b>월 / 금</b> · 저녁 <b>월 / 목</b> · 주 1회 (월 4회)', AE, '오전 <b>월 20만원</b> · 저녁 <b>월 25만원</b>'],
    jr: ['JUNIOR · REGULAR', '일반 유소년반', '즐겁게 배드민턴 기본 자세와 기술을 익히고, 학교 배드민턴 수행평가에 필요한 동작을 미리 배우고 연습하는 수업입니다. 기초 체력과 자신감도 함께 키웁니다.', '<b>월·화·수·목</b> 중 하나 · 주 1회 (월 4회)', '15:00–18:00', '<b>월 15만원</b>'],
    pf: ['JUNIOR · PERFORMANCE', '주니어 퍼포먼스반', '정확한 기본기와 풋워크, 경기 상황별 기술을 집중적으로 훈련합니다. 기술 완성도와 실전 경기력을 높이고 싶은 주니어를 위한 수업입니다.', '<b>월 / 금</b> 중 하나 · 주 1회 (월 4회)', '15:00–18:00', '<b>월 20만원</b>'],
  };
  const DAY = ['월', '화', '수', '목', '금'];
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const coach = n => {
    const c = CO[n] || [n + ' 코치', '', []];
    return `<div class="lp-c">${c[1] ? `<img src="images/coach/${c[1]}" alt="${esc(c[0])}">` : `<i class="ph" aria-hidden="true">${esc(n[0] || '')}</i>`}<b>${esc(c[0])}</b>${c[2].length ? `<ul>${c[2].map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  };
  let last = null;
  function open(b) {
    const k = Object.keys(CL).find(x => b.classList.contains('lk-' + x)); if (!k) return;
    const c = CL[k], tr = b.closest('tr'), i = [...tr.children].indexOf(b.closest('td')) - 1;
    const t = tr.querySelector('.lt-tm b').textContent, e = tr.querySelector('.lt-tm small').textContent.replace('– ', '');
    const cos = b.querySelector('em').textContent.split(' · ').map(x => x.trim()).filter(Boolean);
    tb.querySelectorAll('.lt-b.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
    pop.innerHTML = `<div class="lp-co"><div class="lp-h">이 타임 코치</div><div class="lp-cs n${cos.length}">${cos.map(coach).join('')}</div></div>
      <div class="lp-in lk-${k}"><div class="lp-en">${c[0]}</div><div class="lp-t" id="ltPopT">${c[1]}</div><div><span class="lp-when">${DAY[i]}요일 ${t}–${e}</span></div><p class="lp-d">${c[2]}</p>
      <div class="lp-i"><div><em>요일</em><span>${c[3]}</span></div><div><em>시간</em><span>${c[4]}</span></div><div><em>수강료</em><span>${c[5]}</span></div></div>
      <div class="lp-btn"><a class="lp-go" href="badminton-apply.html">레슨 등록 <span aria-hidden="true">→</span></a><a href="oneday.html">원데이 신청 <span aria-hidden="true">→</span></a></div></div>
      <button type="button" class="lp-x" aria-label="닫기">×</button>`;
    last = b; bg.hidden = false; document.body.style.overflow = 'hidden'; pop.scrollTop = 0;
    pop.querySelector('.lp-x').focus({ preventScroll: true });
  }
  function close() {
    if (bg.hidden) return;
    bg.hidden = true; document.body.style.overflow = '';
    tb.querySelectorAll('.lt-b.on').forEach(x => x.classList.remove('on'));
    if (last) last.focus({ preventScroll: true });
  }
  tb.querySelectorAll('.lt-b').forEach(b => { b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-haspopup', 'dialog'); });
  tb.addEventListener('click', e => { const b = e.target.closest('.lt-b'); if (b) open(b); });
  tb.addEventListener('keydown', e => { const b = e.target.closest('.lt-b'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(b); } });
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('.lp-x')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

/* ---------- 레슨 반 탭 (2026-11-28) ----------
   badminton.html 레슨 탭의 반 탭(#lkTabs): [전체] = 반 소개 줄 전부 + 전체 시간표,
   반 탭 = 그 반 소개 한 줄(#lrList .lr-r) + 색 안내 그 반 줄(.lt-lr) + 시간표에서 그 반 칸(.lt-b.lk-*)만 — 칸이 없는 타임 줄은 숨김.
   주말반은 아직 시간표 칸이 없어 표 대신 오픈 예정 안내(#ltSoon)만. 숨김은 style.css .off */
(function () {
  const tabs = document.getElementById('lkTabs'), tb = document.querySelector('table.lt');
  if (!tabs || !tb) return;
  const wrap = document.getElementById('ltWrap'), soon = document.getElementById('ltSoon'), hint = document.querySelector('.lt-hint');
  const off = (el, v) => el && el.classList.toggle('off', !!v);
  function pick(k) {
    tabs.querySelectorAll('button').forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('#lrList .lr-r, .lt-lg .lt-lr').forEach(r => off(r, k && r.dataset.k !== k));
    let any = false, first = null;
    tb.querySelectorAll('tbody tr').forEach(tr => {
      let n = 0;
      tr.querySelectorAll('.lt-b').forEach(b => { const hide = k && !b.classList.contains('lk-' + k); off(b, hide); if (!hide) n++; });
      off(tr, !n); tr.classList.remove('first');
      if (n) { any = true; first = first || tr; }
    });
    if (first) first.classList.add('first');
    off(wrap, !any); off(hint, !any); off(document.querySelector('.lt-lg'), !any);
    off(soon, k && k !== 'wk');
  }
  tabs.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) pick(b.dataset.k); });
})();
