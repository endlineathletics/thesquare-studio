/**
 * THE SQUARE 대관 예약 — Google Apps Script 백엔드
 * 예약이 이 스프레드시트의 "예약" 시트에 한 줄(1시간)씩 쌓입니다.
 * 상태 열을 "취소"로 바꾸면 그 시간이 다시 예약 가능해집니다.
 * 설정 방법은 booking/SETUP.md 참고.
 */

const SHEET_NAME = '예약';
const NOTIFY_EMAIL = '';   // 새 예약 알림을 받을 이메일 (비워두면 알림 없음)

const SPACES = {
  badminton: { name: '배드민턴센터', price: 52800, courts: ['코트 1', '코트 2', '코트 3'] },
  yoga:      { name: '요가센터',     price: 100000, courts: ['공간 전체'] },
};
const HEADER = ['접수시각', '신청번호', '공간', '날짜', '코트', '시작', '종료', '이름', '연락처', '인원', '요청사항', '금액', '상태'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER.length).setFontWeight('bold');
  }
  return sh;
}

const pad_ = n => ('0' + n).slice(-2);
const out_ = obj => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

/** space+date 에 이미 잡힌 [{court, hour}] */
function taken_(spaceKey, date) {
  const sp = SPACES[spaceKey];
  const rows = sheet_().getDataRange().getDisplayValues().slice(1);
  return rows
    .filter(r => r[2] === sp.name && r[3] === date && r[12] !== '취소')
    .map(r => ({ court: sp.courts.indexOf(r[4]), hour: parseInt(r[5], 10) }));
}

function doGet(e) {
  const p = e.parameter || {};
  if (p.action === 'slots' && SPACES[p.space] && /^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) {
    return out_({ ok: true, slots: taken_(p.space, p.date) });
  }
  return out_({ ok: false, error: 'bad_request' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  const sp = SPACES[d.space];
  const name = String(d.name || '').trim().slice(0, 40);
  const phone = String(d.phone || '').trim().slice(0, 20);
  const items = Array.isArray(d.items) ? d.items.slice(0, 72) : [];
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  if (!sp || !name || !/^[0-9\-+ ]{9,}$/.test(phone) || !items.length) return out_({ ok: false, error: 'invalid' });
  for (const it of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date) || it.date < today || !(it.hour >= 0 && it.hour <= 23) || !(it.court >= 0 && it.court < sp.courts.length)) {
      return out_({ ok: false, error: 'invalid_item' });
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const conflicts = [];
    const byDate = {};
    items.forEach(it => {
      byDate[it.date] = byDate[it.date] || taken_(d.space, it.date);
      if (byDate[it.date].some(t => t.court === it.court && t.hour === it.hour)) conflicts.push(it);
    });
    if (conflicts.length) return out_({ ok: false, error: 'conflict', conflicts });

    const id = 'TS' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
    const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    const rows = items.map(it => [
      now, id, sp.name, "'" + it.date, sp.courts[it.court], "'" + pad_(it.hour) + ':00', "'" + pad_(it.hour + 1) + ':00',
      name, "'" + phone, String(d.people || ''), String(d.memo || '').slice(0, 500), sp.price, '신청',
    ]);
    const sh = sheet_();
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, `[THE SQUARE] 새 대관 예약 신청 ${id}`,
        `${sp.name}\n` + items.map(it => `- ${it.date} ${sp.courts[it.court]} ${pad_(it.hour)}:00~${pad_(it.hour + 1)}:00`).join('\n') +
        `\n합계: ${(items.length * sp.price).toLocaleString()}원\n이름: ${name}\n연락처: ${phone}\n인원: ${d.people || '-'}\n요청사항: ${d.memo || '-'}`);
    }
    return out_({ ok: true, id });
  } finally {
    lock.releaseLock();
  }
}
