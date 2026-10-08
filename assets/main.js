(function () {
  /* nav */
  const nav = document.getElementById('nav');
  const top = document.querySelector('.hero, .page-hero');
  const onScroll = () => nav.classList.toggle('solid', !top || window.scrollY > top.offsetHeight - 90);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.getElementById('burger').addEventListener('click', () => nav.classList.toggle('open'));

  /* floating apply button — sits at the main banner's bottom-right, then stays fixed there */
  const fab = document.querySelector('.apply-fab');
  if (fab && top) {
    const place = () => {
      if (window.innerWidth <= 640) { fab.style.bottom = ''; return; }   // 모바일은 화면 오른쪽 아래 고정
      const heroBottom = top.offsetTop + top.offsetHeight;
      const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fab-gap')) || 32;
      const off = Math.max(gap, Math.min(window.innerHeight - heroBottom + gap, window.innerHeight * 0.45));
      fab.style.bottom = off + 'px';
    };
    place();
    window.addEventListener('resize', place);
  }

  /* active menu */
  const page = document.body.dataset.page;
  document.querySelectorAll('#menu a').forEach(a => {
    if (a.dataset.page === page) a.classList.add('on');
  });

  /* 대관 / 레슨 탭: 누르면 그 구역으로 스크롤, 스크롤하면 지금 구역 탭이 켜짐 */
  const tabs = document.getElementById('secTabs');
  if (tabs) {
    const links = [...tabs.querySelectorAll('a')];
    const targets = links.map(a => document.querySelector(a.getAttribute('href')));
    const sync = () => {
      const y = window.scrollY + tabs.getBoundingClientRect().bottom + 80;
      let cur = 0;
      targets.forEach((t, i) => { if (t && t.offsetTop <= y) cur = i; });
      links.forEach((a, i) => a.classList.toggle('on', i === cur));
    };
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /* reveal */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  /* timetable */
  const DAYS = ['월', '화', '수', '목', '금'];
  const DAYS_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  function clsHTML(cell, cats, catFn) {
    const k = cell[2] || catFn(cell[0]);
    const c = cats[k];
    return `<div class="cls" data-cat="${k}" style="--c:${c.c};--bg:${c.bg}"><b>${cell[0]}</b><span>${cell[1]}</span></div>`;
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

  document.querySelectorAll('[data-timetable]').forEach(root => {
    const kind = root.dataset.timetable;
    const bd = kind === 'badminton';
    const data = bd ? window.BD_SCHEDULE : window.YOGA_SCHEDULE;
    const cats = bd ? window.BD_CATS : window.YOGA_CATS;
    const catFn = bd ? window.bdCat : window.yogaCat;
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
        Object.entries(cats).map(([k, c]) => `<button type="button" class="chipbtn" data-k="${k}"><i style="background:${c.c}"></i>${c.label}</button>`).join('');
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
  });
})();
