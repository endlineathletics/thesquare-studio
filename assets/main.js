(function () {
  /* nav */
  const nav = document.getElementById('nav');
  const top = document.querySelector('.hero, .page-hero');
  const onScroll = () => nav.classList.toggle('solid', !top || window.scrollY > top.offsetHeight - 90);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.getElementById('burger').addEventListener('click', () => nav.classList.toggle('open'));

  const fab = document.querySelector('.apply-fab');   // 수강신청 버튼: 화면 크기와 상관없이 오른쪽 아래 고정 (CSS)

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
    const show = (name, scroll) => {
      panes.forEach(p => { p.hidden = p.dataset.pane !== name; });
      links.forEach(a => a.classList.toggle('on', a.dataset.tab === name));
      if (fab) fab.classList.toggle('hide', name === 'rental');   // 대관 화면에서는 수강신청 버튼 숨김
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

  /* reveal */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  /* timetable */
  const DAYS = ['월', '화', '수', '목', '금'];
  const DAYS_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  // 요가 시간표는 관리프로그램에서 받은 글(수업 이름·강사)이 들어오므로 HTML 로 넣기 전에 이스케이프 (2026-10-18)
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

  /* 요가 시간표 = 관리프로그램의 매주 반복 수업 (2026-10-18 "요가 수업명 관리자에서 바꾸면 홈페이지도 반영되게") —
     /api/site?action=yoga_schedule 로 받아 schedule.js 의 YOGA_SCHEDULE(예비 — 못 받으면 그대로 보임)을 틀로 칸만 바꿔 다시 그린다:
     같은 시각 줄은 요일 칸을 관리프로그램 값으로(없으면 빈 칸, 대관 'R' 자리는 그대로), 표에 없는 시각은 시각 순으로 그 구역에 끼우고,
     수업이 다 없어진 줄은 뺀다. 구역 이름·대관 띠는 schedule.js 그대로. */
  function yogaFromApi(classes, base) {
    const byTime = {};
    classes.forEach(c => {
      if (!(c.wd >= 0 && c.wd < 5) || !c.start || !c.end || !c.name) return;
      (byTime[c.start + '~' + c.end] = byTime[c.start + '~' + c.end] || [null, null, null, null, null])[c.wd] = [String(c.name), String(c.coach || '')];
    });
    const out = [], used = new Set();
    base.forEach(s => {
      if (!s.cells) { out.push(s); return; }
      const k = s.time + '~' + s.end, live = byTime[k];
      used.add(k);
      out.push(Object.assign({}, s, { cells: s.cells.map((cell, i) => (live && live[i]) || (cell === 'R' ? 'R' : null)) }));
    });
    Object.keys(byTime).filter(k => !used.has(k)).sort().forEach(k => {
      const [time, end] = k.split('~');
      let at = out.findIndex(s => s.time && s.time > time);
      if (at < 0) at = out.length;
      else if (at > 1 && out[at - 1].section) at--;          // 다음 구역 머리 앞 = 앞 구역 끝 (맨 앞 구역 머리는 넘지 않음)
      out.splice(at, 0, { time, end, cells: byTime[k] });
    });
    return out.filter(s => !s.cells || s.cells.some(c => c));
  }
  function loadYogaLive() {
    const api = window.BOOKING && window.BOOKING.api;
    if (!api || !window.fetch || !window.AbortController) return Promise.resolve(null);
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    return fetch(api + '?action=yoga_schedule', { signal: ctl.signal, credentials: 'omit' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.ok && Array.isArray(j.classes) && j.classes.length ? yogaFromApi(j.classes, window.YOGA_SCHEDULE) : null))
      .catch(() => null)
      .finally(() => clearTimeout(t));
  }

  document.querySelectorAll('[data-timetable]').forEach(root => {
    initTimetable(root);
    if (root.dataset.timetable === 'yoga') {
      loadYogaLive().then(data => {
        if (!data) return;
        window.YOGA_SCHEDULE = data;                          // 강사 범례(yogaTeacherCats)도 새 표 기준
        root.querySelectorAll('.daytabs, .chips').forEach(el => el.replaceWith(el.cloneNode(false)));   // 옛 click 처리 떼기
        initTimetable(root);
      });
    }
  });

  function initTimetable(root) {
    const kind = root.dataset.timetable;
    const bd = kind === 'badminton';
    const data = bd ? window.BD_SCHEDULE : window.YOGA_SCHEDULE;
    // 요가는 강사별 색 (2026-10-18 — 같은 강사 수업은 같은 색, 칩 = 강사 범례 가나다순 · 누르면 그 강사 수업만 진하게)
    const cats = bd ? window.BD_CATS : window.yogaTeacherCats();
    const catFn = bd ? window.bdCat : (name, cell) => cell[1];
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
