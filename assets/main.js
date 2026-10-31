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
    const hero = document.querySelector('.page-hero[data-hero]');   // 배드민턴 머리 사진 — 탭마다 다른 사진 (style.css .bd-pic)
    const show = (name, scroll) => {
      panes.forEach(p => { p.hidden = p.dataset.pane !== name; });
      links.forEach(a => a.classList.toggle('on', a.dataset.tab === name));
      if (hero) hero.dataset.hero = name;
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
