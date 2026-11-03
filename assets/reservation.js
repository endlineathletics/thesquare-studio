/* ============================================================
   대관 예약 확인·취소 (reservation.html) — 2026-11-04 사용자 "알림톡 링크 눌러서 홈페이지 내 예약 페이지로 이동해서 확인 및 취소"
   ?t=<토큰> 으로 들어오면(관리프로그램 /b/<토큰> 이 넘김) 관리프로그램 /api/site 에서 값을 읽어 그 번호의 대관 카드를 그린다 (action rental_view — 읽기만),
   [예약 취소]는 확인창 뒤 action rental_cancel — 누르는 순간 코트가 풀리고 되돌릴 수 없다. 환불은 관리자가 확정할 때 움직인다 (규격: 관리프로그램 docs/site-api.md 10절).
   토큰이 없거나 지났으면 휴대폰 번호로 새 링크 받기 (action rental_link) —
   - 번호에 대관이 있든 없든 응답은 같음({ ok: true }) — 화면도 늘 같은 안내 (어느 번호가 대관했는지 드러나지 않게).
   - 신청번호 + 번호로 바로 보여 주는 방식은 쓰지 않음 — 신청번호(TS+날짜+일련번호)가 짐작하기 쉬워서 (2026-10-31 사용자 결정).
   - 보낸 뒤 30초 동안은 다시 못 누름 (같은 번호로 알림이 몰리지 않게 — 번호 · IP 별 횟수 제한은 관리프로그램이 따로 함).
   글은 모두 esc 를 거쳐 넣는다 (단체명 등 손님이 쓴 글이 섞여 있음). 주소 · 대관 문의 번호는 booking-config.js(window.BOOKING) 그대로.
   ============================================================ */
(function () {
  const form = document.getElementById('rsvForm');
  if (!form) return;
  // 아래 초기화가 어디서 죽어도 브라우저 기본 제출(GET — 화면이 새로 고쳐짐)은 먼저 막아 둔다. 번호 칸은 name 이 없다
  form.addEventListener('submit', e => e.preventDefault());
  const CFG = window.BOOKING || {};
  const PHONE = (CFG.spaces && CFG.spaces.badminton && CFG.spaces.badminton.phone) || '010-7569-1861';   // 대관 문의 번호
  const WAIT = 30;   // 보낸 뒤 다시 누를 수 있을 때까지 (초)
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = n => `${Number(n || 0).toLocaleString('ko-KR')}원`;
  const input = $('rsvPhone'), fld = $('rsvFld'), btn = $('rsvGo'), msg = $('rsvMsg');
  const lead = $('rsvLead'), list = $('rsvList'), notes = $('rsvNotes'), notice = $('rsvNotice');
  const LABEL = btn.textContent;
  const TEL = `<a href="tel:${esc(PHONE)}">${esc(PHONE)}</a>`;
  const SENT = `입력하신 번호로 신청하신 대관이 있으면 링크를 보냈습니다. 몇 분 안에 오지 않으면 번호를 다시 확인하시거나 대관 문의 ${TEL}로 연락해 주세요.`;
  const LIMITED = ['rate_limited', 'too_many', 'limited', 'busy'];   // 횟수 초과 등 — 잠시 뒤 다시
  const TOKEN = new URLSearchParams(location.search).get('t') || '';
  let busy = false, left = 0, timer = 0, data = null;

  /** 관리프로그램 /api/site POST → 응답 JSON (연결 실패 · JSON 아님은 throw — 오류 응답 4xx 도 JSON 이라 그대로 읽음).
      text/plain 은 사전 요청(OPTIONS) 없이 보내려는 것 (booking.js post 와 같게) */
  async function post(body) {
    const res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return res.json();
  }

  /** 맨 위 안내 — kind: ok / err, html 은 이미 이스케이프한 글 */
  function tell(html, kind) {
    notice.className = 'rsv-msg' + (kind ? ' ' + kind : '');
    notice.innerHTML = html;
  }

  /* ---------- 번호로 링크 받기 ---------- */
  function showForm(text) {
    list.hidden = true;
    list.innerHTML = '';
    form.hidden = false;
    notes.hidden = false;
    if (text) lead.textContent = text;
  }
  function hideForm() {
    form.hidden = true;
    notes.hidden = true;
  }
  // 숫자만 — 붙여 넣은 국제 번호(+82 10-…)는 0 으로 (관리프로그램 site_phone 과 같게)
  const digits = () => { const d = input.value.replace(/\D/g, ''); return /^8210/.test(d) ? '0' + d.slice(2) : d; };
  const valid = d => /^01\d{8,9}$/.test(d);   // 휴대폰 10~11자리 (유선 · 모양이 틀린 번호는 관리프로그램이 다시 보고 'phone' 오류)

  /* 번호 자동 하이픈 (apply.js 연락처와 같게) */
  input.addEventListener('input', () => {
    const d = digits().slice(0, 11);
    input.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
    if (fld.classList.contains('err') && valid(d)) bad(false);
  });

  /** 번호 칸 오류 표시 켜기 · 끄기 (.fld.err — 칸 아래 빨간 글, style.css) */
  function bad(on) {
    fld.classList.toggle('err', on);
    input.setAttribute('aria-invalid', String(on));
    input.setAttribute('aria-describedby', on ? 'rsvErr rsvHint' : 'rsvHint');
    if (on) input.focus();
  }
  /** 칸 아래 안내 — kind: ok(보냄) / err(못 보냄), html 은 이미 이스케이프한 글 */
  function say(html, kind) {
    msg.className = 'rsv-msg' + (kind ? ' ' + kind : '');
    msg.innerHTML = html;
  }
  /** 보낸 뒤 WAIT 초 동안 버튼을 끄고 남은 초를 보여 줌 → 끝나면 [링크 다시 받기] */
  function cool() {
    left = WAIT;
    btn.disabled = true;
    const tick = () => {
      if (left <= 0) { clearInterval(timer); timer = 0; btn.disabled = false; btn.textContent = '링크 다시 받기'; return; }
      btn.textContent = `링크 다시 받기 (${left}초)`;
      left -= 1;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  form.addEventListener('submit', async () => {
    if (busy || timer) return;
    const d = digits();
    if (!valid(d)) { bad(true); say('', ''); return; }
    bad(false);
    if (!CFG.api) { say(`지금은 온라인으로 링크를 보낼 수 없습니다. 대관 문의 ${TEL}로 연락해 주세요.`, 'err'); return; }
    busy = true;
    btn.disabled = true;
    btn.textContent = '보내는 중…';
    say('', '');
    let r = null;
    try { r = await post({ action: 'rental_link', phone: d }); } catch (e) { r = null; }
    busy = false;
    if (r && r.ok) { say(SENT, 'ok'); cool(); return; }
    btn.disabled = false;
    btn.textContent = LABEL;
    if (!r) say(`연결에 실패했습니다. 인터넷 연결을 확인하고 다시 눌러 주시거나, 대관 문의 ${TEL}로 연락해 주세요.`, 'err');
    else if (r.error === 'phone') bad(true);
    else if (LIMITED.includes(r.error)) say('요청이 많아 잠시 받을 수 없습니다. 잠시 후 다시 시도해 주세요.', 'err');
    // 그 밖(forbidden · bad_request — 기능이 아직 없는 관리프로그램 · server_error 등) — 전화로
    else say(`지금은 링크를 보낼 수 없습니다. 대관 문의 ${TEL}로 연락해 주세요.`, 'err');
  });

  /* ---------- 예약 카드 ---------- */
  const lineText = l => `${l.d} ${l.time} · ${l.where}`;
  const people = p => (p ? `${p}${/^\d+$/.test(String(p)) ? '명' : ''}` : '');
  const STATE_NOTE = {
    req_open: '환불 금액은 담당자가 확인한 뒤 돌려드려요. 처리되면 카카오톡 · 문자로 알려 드려요.',
    unpaid: '대관료 결제 전이에요. 결제 방법은 대관 문의로 연락해 주세요.',
    new: '체육관에서 신청을 확인하고 있어요. 확정되면 카카오톡 · 문자로 알려 드려요.',
  };

  /** 지금 취소하면 규정상 돌려받을 돈 — 한 줄이면 규칙까지, 여러 줄이면 줄마다 */
  function estimateHtml(est) {
    if (!est) return '';
    const rows = est.lines.map(l => `<li><span>${esc(l.d)} ${esc(l.time)}</span><span>${esc(l.rule)} · ${won(l.refund)}</span></li>`).join('');
    return `<div class="rsv-est"><div class="rsv-est-h"><span>지금 취소하면 예상 환불</span><b>${won(est.amount)}</b></div><ul>${rows}</ul></div>`;
  }

  function cardHtml(c) {
    const f = c.lines[0] || { d: '', time: '', where: '' };
    const dl = [['예약번호', esc(c.no)], ['이용', c.lines.map(l => esc(lineText(l))).join('<br>')]];
    if (c.offLines.length) dl.push(['취소한 시간', c.offLines.map(l => `<s>${esc(lineText(l))}</s>`).join('<br>')]);
    dl.push(['예약자', esc(c.who)]);
    if (c.org) dl.push(['단체명', esc(c.org)]);
    if (c.people) dl.push(['인원', esc(people(c.people))]);
    dl.push(['금액', `<b>${won(c.total)}</b>`]);
    if (c.pay) {
      const how = [c.pay.how, c.pay.card, c.pay.at].filter(Boolean).map(esc).join(' · ');
      const receipt = c.pay.receipt ? ` <a href="${esc(c.pay.receipt)}" target="_blank" rel="noopener noreferrer">영수증</a>` : '';
      dl.push(['결제', `${how}${receipt}`]);
    }
    if (c.cancelledAt) dl.push(['취소한 때', esc(c.cancelledAt)]);
    if (c.refund) dl.push(['환불', `<b class="rsv-refund">${esc(c.refund)}</b>`]);
    let foot = '';
    if (c.canCancel) {
      foot = `<div class="rsv-cancel">${estimateHtml(c.estimate)}
        <button type="button" class="rsv-cancel-btn" data-cancel="${esc(c.no)}">예약 취소</button>
        <p class="rsv-note">취소하면 그 시간은 바로 다른 분이 예약할 수 있어 되돌릴 수 없어요.${c.estimate ? ' 환불은 담당자가 확인한 뒤 진행돼요.' : ''}</p></div>`;
    } else if (c.busy) {
      foot = '<p class="rsv-note">결제를 확인하는 중이라 지금은 취소할 수 없어요. 잠시 뒤 다시 열어 주세요.</p>';
    } else if (c.started) {
      foot = `<p class="rsv-note">이용 시작 시각이 지나 여기서는 취소할 수 없어요. 대관 문의 ${TEL}로 연락해 주세요.</p>`;
    }
    const stateNote = STATE_NOTE[c.state] ? `<p class="rsv-note">${esc(STATE_NOTE[c.state])}</p>` : '';
    return `<details class="rsv-bk" id="b-${esc(c.no)}"${c.open || c.upcoming ? ' open' : ''}>
      <summary>
        <span class="rsv-top"><span class="rsv-chip ${esc(c.tone)}">${esc(c.label)}</span>${c.when ? `<span class="rsv-left">${esc(c.when)}</span>` : ''}</span>
        <span class="rsv-when">${esc(f.d)} ${esc(f.time)}${c.lines.length > 1 ? ` <small>외 ${c.lines.length - 1}건</small>` : ''}</span>
        <span class="rsv-sub">${esc(f.where)}${c.org ? ` · ${esc(c.org)}` : ''}</span>
      </summary>
      <div class="rsv-body">
        <dl class="rsv-dl">${dl.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
        ${stateNote}${foot}
      </div>
    </details>`;
  }

  function render(v) {
    data = v;
    hideForm();
    lead.textContent = `${v.phone} 번호로 신청하신 대관이에요.`;
    const up = v.cards.filter(c => c.upcoming), past = v.cards.filter(c => !c.upcoming);
    const tel = v.tel || PHONE;
    list.innerHTML = `
      ${up.length ? `<h2 class="rsv-h">다가오는 대관</h2>${up.map(cardHtml).join('')}` : '<p class="rsv-empty">다가오는 대관이 없어요.</p>'}
      ${past.length ? `<h2 class="rsv-h">지난 대관</h2>${past.map(cardHtml).join('')}` : ''}
      ${v.policy ? `<details class="rsv-policy"><summary>${esc(v.policy.title || '대관 환불 규정')}</summary><div class="rsv-policy-body">${esc(v.policy.body)}</div></details>` : ''}
      <div class="rsv-help">
        <p>예약 변경이나 환불 문의는 대관 담당자에게 연락해 주세요.</p>
        <a class="rsv-tel" href="tel:${esc(tel.replace(/\D/g, ''))}">전화하기 ${esc(tel)}</a>
      </div>
      <p class="rsv-foot">최근 ${esc(v.checkDays)}일 안에 이용한(하실) 신청만 보여요. 이 링크는 ${esc(v.until)}까지 열려요 — 다른 사람에게 보내지 마세요.</p>`;
    list.hidden = false;
  }

  /** 예약 읽기 — 죽은 링크면 번호로 새 링크 받기, 연결 실패면 다시 시도 */
  async function load() {
    if (!CFG.api) { showForm(); tell(`지금은 온라인으로 예약을 볼 수 없습니다. 대관 문의 ${TEL}로 연락해 주세요.`, 'err'); return; }
    hideForm();
    lead.textContent = '예약을 불러오는 중이에요…';
    let r = null;
    try { r = await post({ action: 'rental_view', t: TOKEN }); } catch (e) { r = null; }
    if (r && r.ok) { render(r); return; }
    if (r && r.error === 'link_dead') {
      showForm('링크가 만료됐거나 잘못된 주소예요. 대관을 신청하신 휴대폰 번호를 입력하시면 새 링크를 보내 드립니다.');
      return;
    }
    lead.textContent = '';
    list.hidden = false;
    list.innerHTML = '<button type="button" class="rsv-tel" data-reload>다시 불러오기</button>';
    tell(r && LIMITED.includes(r.error) ? '요청이 많아 잠시 볼 수 없어요. 잠시 후 다시 시도해 주세요.'
      : `예약을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도하시거나, 대관 문의 ${TEL}로 연락해 주세요.`, 'err');
  }

  list.addEventListener('click', async e => {
    if (e.target.closest('[data-reload]')) { tell('', ''); load(); return; }
    const b = e.target.closest('[data-cancel]');
    if (!b || busy || !data) return;
    const no = b.getAttribute('data-cancel'), c = data.cards.find(x => x.no === no);
    if (!c) return;
    const yes = await window.PAYUI.confirm({
      title: '이 예약을 취소할까요?', okText: '예약 취소하기', noText: '돌아가기',
      rows: [['예약번호', c.no], ['이용', c.lines.map(lineText).join('\n')], ['예상 환불', c.estimate ? won(c.estimate.amount) : '']],
      note: `취소하면 그 시간은 바로 다른 분이 예약할 수 있어 되돌릴 수 없어요.${c.estimate ? ' 환불은 담당자가 확인한 뒤 진행돼요.' : ''}`,
    });
    if (!yes) return;
    busy = true;
    b.disabled = true;
    b.textContent = '취소하는 중…';
    let r = null;
    try { r = await post({ action: 'rental_cancel', t: TOKEN, no }); } catch (err) { r = null; }
    busy = false;
    if (r && r.error === 'link_dead') {
      showForm('링크가 만료됐거나 잘못된 주소예요. 대관을 신청하신 휴대폰 번호를 입력하시면 새 링크를 보내 드립니다.');
      return;
    }
    if (r && r.cards) {
      render(r);
      tell(esc(r.message), r.ok ? 'ok' : 'err');
    } else {
      // 연결이 끊겨 결과를 모름 — 코트가 풀렸을 수 있으니 지금 상태를 다시 읽는다
      tell(r && LIMITED.includes(r.error) ? '요청이 많아 취소하지 못했어요. 잠시 후 다시 시도해 주세요.'
        : `결과를 확인하지 못했어요. 아래 상태를 확인해 주시고, 그대로면 다시 시도하거나 대관 문의 ${TEL}로 연락해 주세요.`, 'err');
      const prev = notice.innerHTML, kind = 'err';
      await load();
      tell(prev, kind);
    }
    notice.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  if (TOKEN) load();
})();
