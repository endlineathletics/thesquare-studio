/**
 * THE SQUARE 대관 예약 · 수강신청 — Google Apps Script 백엔드
 * 대관 예약은 "예약" 시트에 한 줄(1시간)씩, 수강신청은 "수강신청" 시트에 한 줄씩 쌓입니다.
 * (관리자 프로그램이 준비되면 수강신청은 그쪽 API로 옮기면 됩니다 — docs/apply-api.md)
 * 상태 열을 "취소"로 바꾸면 그 시간이 다시 예약 가능해집니다.
 * 설정 방법은 booking/SETUP.md 참고.
 */

const SHEET_NAME = '예약';
const NOTIFY_EMAIL = '';   // 새 예약 알림을 받을 이메일 (비워두면 알림 없음)

const SPACES = {
  badminton: { name: '배드민턴센터', price: 52800, courts: ['코트 1', '코트 2', '코트 3'] },
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

/** 시트 수식 주입 방지: 사용자가 입력한 글자가 = + - @ 로 시작하면 앞에 ' 를 붙여 글자로 저장 */
const safe_ = v => (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;

/** 신청번호: 접두어 + 날짜 + 그날의 일련번호 (예: AP261001-003). 반드시 lock 안에서 호출 */
function nextId_(prefix) {
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMdd');
  const props = PropertiesService.getScriptProperties();
  const key = 'seq_' + prefix + day;
  const n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return prefix + day + '-' + ('00' + n).slice(-3);
}

/** 알림 메일 — 실패해도 접수 결과에는 영향 없음 */
function notify_(subject, body) {
  if (!NOTIFY_EMAIL) return;
  try {
    if (MailApp.getRemainingDailyQuota() > 0) MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch (err) {
    console.error('notify failed', err);
  }
}

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
  if (d.action === 'apply') return apply_(d);
  const sp = SPACES[d.space];
  const name = String(d.name || '').trim().slice(0, 40);
  const phone = String(d.phone || '').trim().slice(0, 20);
  const items = Array.isArray(d.items) ? d.items.slice(0, 72) : [];
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  if (!sp || !name || !/^[0-9\-+ ]{9,}$/.test(phone) || !items.length) return out_({ ok: false, error: 'invalid' });
  const seen = {};
  for (const it of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date) || it.date < today ||
        !Number.isInteger(it.hour) || it.hour < 0 || it.hour > 23 ||
        !Number.isInteger(it.court) || it.court < 0 || it.court >= sp.courts.length) {
      return out_({ ok: false, error: 'invalid_item' });
    }
    const k = `${it.date}|${it.court}|${it.hour}`;
    if (seen[k]) return out_({ ok: false, error: 'invalid_item' });
    seen[k] = true;
  }

  let id;
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

    id = nextId_('TS');
    const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    const rows = items.map(it => [
      now, id, sp.name, "'" + it.date, sp.courts[it.court], "'" + pad_(it.hour) + ':00', "'" + pad_(it.hour + 1) + ':00',
      name, "'" + phone, String(d.people || '').slice(0, 10), String(d.memo || '').slice(0, 500), sp.price, '신청',
    ].map(safe_));
    const sh = sheet_();
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
  } finally {
    lock.releaseLock();
  }
  notify_(`[THE SQUARE] 새 대관 예약 신청 ${id}`,
    `${sp.name}\n` + items.map(it => `- ${it.date} ${sp.courts[it.court]} ${pad_(it.hour)}:00~${pad_(it.hour + 1)}:00`).join('\n') +
    `\n합계: ${(items.length * sp.price).toLocaleString()}원\n이름: ${name}\n연락처: ${phone}\n인원: ${d.people || '-'}\n요청사항: ${d.memo || '-'}`);
  return out_({ ok: true, id });
}

/* ---------------- 수강신청 ---------------- */
const APPLY_SHEET = '수강신청';
const APPLY_HEADER = ['접수시각', '신청번호', '구분', '이름', '성별', '나이(만)', '연락처', '급수', '경력', '희망 반/수업', '희망 시간', '희망 코치/강사',
  '거주 지역', '법정대리인(만14세 미만)', '개인정보·알림 동의', '상태', '요청ID'];

function applySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(APPLY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(APPLY_SHEET);
    sh.appendRow(APPLY_HEADER);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, APPLY_HEADER.length).setFontWeight('bold');
  }
  return sh;
}

function apply_(d) {
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const type = d.type === 'badminton' ? '배드민턴' : d.type === 'yoga' ? '요가' : '';
  const name = str(d.name, 30), phone = str(d.phone, 20), region = str(d.region, 40);
  const age = Number(d.age);
  const ag = d.agreements || {};
  const p = d.preference;
  const minor = age < 14;
  const g = d.guardian || {};
  if (!type || !name || !/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone) || !Number.isInteger(age) || age < 3 || age > 99 ||
      !['남', '여'].includes(d.gender) || !region || !ag.privacy || !p || !str(d.experience, 30) ||
      (type === '배드민턴' && !str(d.grade, 20)) ||
      (minor && (!str(g.name, 30) || !str(g.relation, 20) || !ag.guardian))) {
    return out_({ ok: false, error: 'invalid' });
  }
  let cls, time, coach;
  if (type === '배드민턴') {
    cls = `${str(p.class, 20)} ${str(p.days, 10)}`; time = str(p.time, 20); coach = str(p.coach, 20);
  } else {
    const list = (Array.isArray(p) ? p : []).slice(0, 40);
    if (!list.length) return out_({ ok: false, error: 'invalid' });
    cls = list.map(x => `${str(x.day, 2)} ${str(x.class, 20)}`).join('\n');
    time = list.map(x => `${str(x.day, 2)} ${str(x.time, 20)}`).join('\n');
    coach = list.map(x => str(x.teacher, 10)).join('\n');
  }
  const clientId = str(d.clientId, 64);
  const guardian = minor ? `${str(g.name, 30)} (${str(g.relation, 20)}) 동의` : '';
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  let id;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = applySheet_();
    // 같은 화면에서 재전송된 신청이면 새로 저장하지 않고 기존 신청번호를 돌려줌
    if (clientId && sh.getLastRow() > 1) {
      const col = APPLY_HEADER.length;
      const ids = sh.getRange(2, 2, sh.getLastRow() - 1, col - 1).getDisplayValues();
      const hit = ids.find(r => r[col - 2] === clientId);
      if (hit) return out_({ ok: true, id: hit[0], duplicate: true });
    }
    id = nextId_('AP');
    sh.appendRow([now, id, type, name, d.gender, age, "'" + phone, str(d.grade, 20), str(d.experience, 30),
      cls, time, coach, region, guardian, now + ' 동의', '접수', clientId].map(safe_));
  } finally {
    lock.releaseLock();
  }
  notify_(`[THE SQUARE] 새 ${type} 수강신청 ${id}`,
    `이름: ${name} (${d.gender}, 만 ${age}세)\n연락처: ${phone}\n급수: ${str(d.grade, 20) || '-'}\n경력: ${str(d.experience, 30)}\n` +
    `희망 반/수업: ${cls}\n희망 시간: ${time}\n희망 코치/강사: ${coach}\n거주 지역: ${region}` + (guardian ? `\n법정대리인: ${guardian}` : ''));
  return out_({ ok: true, id });
}
