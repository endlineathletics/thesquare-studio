/* ============================================================
   대관 예약 조회 (reservation.html) — 2026-10-31 사용자 "대관한 사람들이 자기 주문을 확인할 방법이 없어"
   휴대폰 번호만 받아 관리프로그램 /api/site 에 { action: 'rental_link', phone: 숫자만 } 을 보냄 → 그 번호로 신청한 대관이 있으면
   관리프로그램이 예약 조회 링크(관리프로그램 화면 — 그 번호의 대관 전부 · [예약 취소 요청])를 알림톡(안 되면 문자)으로 보냄.
   - 번호에 대관이 있든 없든 응답은 같음({ ok: true }) — 화면도 늘 같은 안내 (어느 번호가 대관했는지 드러나지 않게).
   - 신청번호 + 번호로 바로 보여 주는 방식은 쓰지 않음 — 신청번호(TS+날짜+일련번호)가 짐작하기 쉬워서 (2026-10-31 사용자 결정). 로그인(비밀번호 · 가입)도 없음.
   - 주소 · 대관 문의 번호는 booking-config.js(window.BOOKING) 그대로 — api 가 비면(문자 접수 방식) 전화 안내만.
   - 보낸 뒤 30초 동안은 다시 못 누름 (같은 번호로 알림이 몰리지 않게 — 번호 · IP 별 횟수 제한은 관리프로그램이 따로 봄).
   ============================================================ */
(function () {
  const form = document.getElementById('rsvForm');
  if (!form) return;
  // 아래 초기화가 어디서 죽어도 브라우저 기본 제출(GET — 화면이 새로 고쳐짐)은 먼저 막아 둔다. 번호 칸은 name 이 없어 주소에 실리지 않음
  form.addEventListener('submit', e => e.preventDefault());
  const CFG = window.BOOKING || {};
  const PHONE = (CFG.spaces && CFG.spaces.badminton && CFG.spaces.badminton.phone) || '010-7576-1861';   // 대관 문의 번호
  const WAIT = 30;   // 보낸 뒤 다시 누를 수 있을 때까지 (초)
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const input = $('rsvPhone'), fld = $('rsvFld'), btn = $('rsvGo'), msg = $('rsvMsg');
  const LABEL = btn.textContent;
  const TEL = `<a href="tel:${esc(PHONE)}">${esc(PHONE)}</a>`;
  const SENT = `입력하신 번호로 신청하신 대관이 있으면 예약 조회 링크를 보냈습니다. 몇 분 안에 오지 않으면 번호를 다시 확인하시거나 대관 문의 ${TEL}로 문의해 주세요.`;
  const LIMITED = ['rate_limited', 'too_many', 'limited', 'busy'];   // 횟수 초과 등 — 잠시 뒤 다시 (관리프로그램 /api/site POST 한도는 IP당 10분 20번)
  let busy = false, left = 0, timer = 0;

  // 숫자만 — 붙여 넣은 국제 번호(+82 10-…)는 0 으로 (관리프로그램 site_phone 과 같게)
  const digits = () => { const d = input.value.replace(/\D/g, ''); return /^8210/.test(d) ? '0' + d.slice(2) : d; };
  const valid = d => /^01\d{8,9}$/.test(d);   // 휴대폰 10~11자리 (유선 · 모양이 틀린 번호는 관리프로그램이 다시 보고 'phone' 오류)

  /* ---------- 번호 자동 하이픈 (apply.js 연락처와 같게) ---------- */
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

  /** 관리프로그램 /api/site POST → 응답 JSON (연결 실패 · JSON 아님은 throw — 오류 응답 4xx 도 JSON 이라 그대로 읽음).
      text/plain 은 사전 요청(OPTIONS) 없이 보내려는 것 (booking.js post 와 같게) */
  async function post(body) {
    const res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return res.json();
  }

  form.addEventListener('submit', async () => {
    if (busy || timer) return;
    const d = digits();
    if (!valid(d)) { bad(true); say('', ''); return; }
    bad(false);
    if (!CFG.api) { say(`지금은 온라인으로 조회 링크를 보낼 수 없습니다. 대관 문의 ${TEL}로 연락해 주세요.`, 'err'); return; }
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
    else say(`지금은 조회 링크를 보낼 수 없습니다. 대관 문의 ${TEL}로 연락해 주세요.`, 'err');
  });
})();
