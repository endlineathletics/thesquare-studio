/* ============================================================
   결제 전 환불 규정 · 결제 확인창 · 결제 완료 화면 (2026-10-18 센터 요청) — apply.js(수강신청) · booking.js(대관)가 같이 씀
   - PAYUI.terms(el, { api, key, phone, onChange }) : 환불 규정 글(관리프로그램 > 안내문 — /api/site GET action=policy)을 보여 주고
       체크칸 [필수] 동의. → { ok() 체크했는지, reset() } . 글을 못 불러오면 체크할 수 없음(결제 버튼도 안 켜짐) + [다시 불러오기]
   - PAYUI.guide({ api, key, phone, check, okText }) → Promise<{version}|null> : 신청 버튼을 누르면 보이는 이용 안내 (2026-11-01) · PAYUI.guideSeen(key) : 이 탭에서 확인한 버전
   - PAYUI.confirm({ title, rows: [[항목, 값]…], amount, note, okText }) → Promise<boolean> : 결제창을 열기 전 마지막 확인
   - PAYUI.done({ title, rows, steps, foot }) → HTML : 결제 완료 화면 (무엇을 · 얼마에 · 다음 할 일)
   - PAYUI.maskPhone('010-1234-5678') → '010-****-5678' (화면에 다시 보여 줄 때)
   글은 모두 이 파일이 이스케이프한다 (rows · steps 의 값은 글자 그대로).
   ============================================================ */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const cache = {};   // key → Promise<{ title, body, updated }>

  function loadPolicy(api, key) {
    if (!cache[key]) {
      cache[key] = fetch(`${api}?action=policy&key=${encodeURIComponent(key)}`)
        .then(r => r.json())
        .then(r => { if (!r || !r.ok || typeof r.body !== 'string') throw new Error('policy'); return r; })
        .catch(e => { delete cache[key]; throw e; });
    }
    return cache[key];
  }

  /** 환불 규정 칸 — 체크해야 결제 버튼이 켜지게 (onChange 로 버튼 상태를 다시 맞춤) */
  function terms(el, o) {
    let loaded = false;
    const id = 'pt-' + Math.random().toString(36).slice(2, 8);
    el.innerHTML = `<div class="pt">
      <div class="pt-h"><b class="pt-title">환불 규정</b><small>결제 전에 꼭 읽어 주세요</small></div>
      <div class="pt-body" id="${id}" tabindex="0" role="region" aria-label="환불 규정">환불 규정을 불러오는 중…</div>
      <label class="pt-ck"><input type="checkbox" disabled aria-describedby="${id}"><span>[필수] 위 환불 규정을 확인했고 동의합니다.</span></label>
      <p class="pt-err" hidden></p>
    </div>`;
    const box = el.querySelector('.pt'), body = box.querySelector('.pt-body'), ck = box.querySelector('input');
    const err = box.querySelector('.pt-err');
    const changed = () => { if (o.onChange) o.onChange(ck.checked && loaded); };
    ck.addEventListener('change', changed);
    function load() {
      err.hidden = true;
      body.textContent = '환불 규정을 불러오는 중…';
      loadPolicy(o.api, o.key).then(p => {
        loaded = true;
        box.querySelector('.pt-title').textContent = p.title || '환불 규정';
        body.setAttribute('aria-label', p.title || '환불 규정');
        body.textContent = p.body;
        ck.disabled = false;
        changed();
      }).catch(() => {
        body.textContent = '';
        err.innerHTML = `환불 규정을 불러오지 못했어요. <button type="button" class="pt-retry">다시 불러오기</button>${o.phone ? `<br>계속 안 되면 ${esc(o.phone)}로 문의해 주세요.` : ''}`;
        err.hidden = false;
        err.querySelector('.pt-retry').onclick = load;
        changed();
      });
    }
    load();
    return { ok: () => loaded && ck.checked, reset() { ck.checked = false; changed(); } };
  }

  /** 신청 전 이용 안내 (2026-11-01 센터 요청 10번 — 레슨·대관 신청 버튼을 누르면 ① 이용수칙 ② 결석·시간/예약 변경 ③ 취소·환불 ④ 체크 ⑤ 계속하기).
      글은 관리프로그램 > 안내문(/api/site GET action=policy — refund_class·refund_rental). 전체를 스크롤해서 보고, 체크칸은 미리 체크하지 않음.
      → Promise<{ version } | null> (null = 취소). 이 탭에서 같은 버전을 이미 확인했으면 다시 묻지 않음(sessionStorage) — 새로고침·결제 실패 뒤 다시 신청.
      확인한 버전은 신청 본문 guide 로 보내 관리프로그램이 버전·일시를 남긴다 */
  const guideKey = key => 'guide:' + key;
  function guideSeen(key) {
    try { const v = JSON.parse(sessionStorage.getItem(guideKey(key)) || 'null'); return v && v.version ? v : null; } catch (e) { return null; }
  }
  function guideText(body) {
    return String(body).split(/\n\s*\n/).map(b => {
      const t = b.trim();
      if (!t) return '';
      return t.startsWith('■') ? `<h3>${esc(t.replace(/^■\s*/, ''))}</h3>` : `<p>${esc(t).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }
  function guide(o) {
    return new Promise(resolve => {
      const dlg = document.createElement('dialog');
      dlg.className = 'gd-dlg';
      dlg.setAttribute('aria-labelledby', 'gdTitle');
      dlg.innerHTML = `<div class="gd-in">
        <h2 id="gdTitle">이용 안내</h2>
        <div class="gd-body" tabindex="0" role="region" aria-labelledby="gdTitle">불러오는 중…</div>
        <label class="pt-ck gd-ck"><input type="checkbox" disabled><span>${esc(o.check)}</span></label>
        <p class="pt-err" hidden></p>
        <div class="gd-acts"><button type="button" class="gd-no">취소</button><button type="button" class="gd-yes" disabled>${esc(o.okText)}</button></div>
      </div>`;
      const ck = dlg.querySelector('input'), yes = dlg.querySelector('.gd-yes'), body = dlg.querySelector('.gd-body'), err = dlg.querySelector('.pt-err');
      let policy = null;
      const finish = v => { if (dlg.open) dlg.close(); dlg.remove(); resolve(v); };
      ck.addEventListener('change', () => { yes.disabled = !(ck.checked && policy); });
      dlg.querySelector('.gd-no').onclick = () => finish(null);
      dlg.addEventListener('cancel', e => { e.preventDefault(); finish(null); });   // Esc
      yes.onclick = () => {
        const v = { version: policy.version };
        try { sessionStorage.setItem(guideKey(o.key), JSON.stringify(v)); } catch (e) { /* 못 써도 이번 신청은 그대로 */ }
        finish(v);
      };
      function load() {
        err.hidden = true;
        body.textContent = '불러오는 중…';
        loadPolicy(o.api, o.key).then(p => {
          const seen = guideSeen(o.key);
          if (seen && seen.version === p.version) { dlg.remove(); resolve(seen); return; }
          policy = p;
          dlg.querySelector('h2').textContent = p.title || '이용 안내';
          body.innerHTML = guideText(p.body);
          body.scrollTop = 0;
          ck.disabled = false;
          if (!dlg.open) dlg.showModal();
        }).catch(() => {
          body.textContent = '';
          err.innerHTML = `이용 안내를 불러오지 못했어요. <button type="button" class="pt-retry">다시 불러오기</button>${o.phone ? `<br>계속 안 되면 ${esc(o.phone)}로 문의해 주세요.` : ''}`;
          err.hidden = false;
          err.querySelector('.pt-retry').onclick = load;
          if (!dlg.open) dlg.showModal();
        });
      }
      document.body.appendChild(dlg);
      load();
    });
  }

  /** 결제 확인창 — 확인(true) / 취소·Esc·바깥 누름(false) */
  function confirm(o) {
    const rows = (o.rows || []).filter(r => r && r[1] !== '' && r[1] != null);
    const okText = o.okText || (o.amount != null ? `${won(o.amount)} 결제하기` : '결제하기');
    if (!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) {   // 아주 옛 브라우저
      const text = [o.title || '결제 전에 확인해 주세요', ...rows.map(([k, v]) => `${k}: ${v}`),
        o.amount != null ? `결제 금액: ${won(o.amount)}` : ''].filter(Boolean).join('\n');
      return Promise.resolve(window.confirm(text));
    }
    return new Promise(resolve => {
      const dlg = document.createElement('dialog');
      dlg.className = 'pc-dlg';
      dlg.setAttribute('aria-labelledby', 'pcTitle');
      dlg.innerHTML = `<div class="pc-in">
        <h2 id="pcTitle">${esc(o.title || '결제 전에 확인해 주세요')}</h2>
        <dl class="pc-rows">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v).replace(/\n/g, '<br>')}</dd></div>`).join('')}</dl>
        ${o.amount != null ? `<div class="pc-amt"><span>결제 금액</span><b>${won(o.amount)}</b></div>` : ''}
        ${o.note ? `<p class="pc-note">${esc(o.note)}</p>` : ''}
        <div class="pc-acts"><button type="button" class="pc-no">${esc(o.noText || '취소')}</button><button type="button" class="pc-yes" autofocus>${esc(okText)}</button></div>
      </div>`;
      document.body.appendChild(dlg);
      // 버튼은 누르는 즉시 결과를 낸다 — dialog 의 close 이벤트는 화면을 그릴 때 오는 브라우저가 있어(숨은 탭 등) 거기에 기대지 않음
      let settled = false;
      const finish = yes => { if (settled) return; settled = true; if (dlg.open) dlg.close(); dlg.remove(); resolve(yes); };
      dlg.querySelector('.pc-yes').addEventListener('click', () => finish(true));
      dlg.querySelector('.pc-no').addEventListener('click', () => finish(false));
      dlg.addEventListener('cancel', e => { e.preventDefault(); finish(false); });     // Esc
      dlg.addEventListener('click', e => { if (e.target === dlg) finish(false); });    // 바깥(배경) 누름
      dlg.addEventListener('close', () => finish(false));
      dlg.showModal();
    });
  }

  /** 결제 완료 화면 HTML — rows: [[항목, 값]] (무엇을 · 얼마에), steps: 다음 할 일 글 목록, foot: 맨 아래 작은 글 */
  function done(o) {
    const rows = (o.rows || []).filter(r => r && r[1] !== '' && r[1] != null);
    return `<div class="pd">
      <div class="pd-ok" aria-hidden="true">✓</div>
      <h2 class="pd-h">${esc(o.title || '결제가 완료됐어요')}</h2>
      ${o.sub ? `<p class="pd-sub">${esc(o.sub)}</p>` : ''}
      ${rows.length ? `<dl class="pd-rows">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v).replace(/\n/g, '<br>')}</dd></div>`).join('')}</dl>` : ''}
      ${o.steps && o.steps.length ? `<div class="pd-next"><b>다음 할 일</b><ol>${o.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
      ${o.foot ? `<p class="pd-foot">${esc(o.foot)}</p>` : ''}
    </div>`;
  }

  function maskPhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    if (d.length < 9) return String(p || '');
    return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
  }

  window.PAYUI = { terms, confirm, done, maskPhone, won, guide, guideSeen };
})();
