# 수강신청 API 규격 (관리자 프로그램 연동용)

홈페이지의 수강신청 페이지(`badminton-apply.html`)는 제출 시
`assets/apply-config.js`의 `api` 주소로 아래 JSON을 **POST** 합니다.
관리자 프로그램은 이 요청을 받아 저장하고, 카카오 알림톡(접수 완료)을 보내면 됩니다.

## 요청

- Method: `POST`
- Header: `Content-Type: text/plain;charset=utf-8` — 본문은 JSON 문자열입니다. (서버에서 `request.get_data()` 후 JSON 파싱)

### ⚠️ CORS는 반드시 설정해야 합니다
text/plain으로 보내는 건 **사전요청(OPTIONS)만 생략**하는 것이고, 응답을 읽으려면 서버가 **모든 응답(성공·실패·4xx/5xx 포함)에**
`Access-Control-Allow-Origin` 헤더를 붙여야 합니다. 빠지면 서버는 저장·알림톡 발송까지 끝냈는데 홈페이지에는 "오류" 화면이 뜨고,
고객이 다시 제출해 **중복 접수 + 알림톡 2번**이 됩니다.
- 허용할 주소: `https://www.thesquarestudio.co.kr`, `https://thesquarestudio.co.kr`, (도메인 연결 전) `https://endlineathletics.github.io`
- Flask라면 `flask-cors`로 위 주소를 허용하거나 `after_request`에서 헤더를 붙이면 됩니다. 쿠키/인증을 쓰지 않으므로 `*`도 동작합니다.

### 중복 제출 방지 (`clientId`)
같은 신청 화면에서 보낸 요청은 모두 같은 `clientId`(UUID)를 가집니다. 서버는 이미 저장된 `clientId`가 다시 오면
**새로 저장하지 말고 기존 신청번호를 그대로 돌려주세요** (알림톡도 다시 보내지 않기). `submittedAt`은 재전송마다 바뀌므로 키로 쓰면 안 됩니다.

### 배드민턴 예시
```json
{
  "action": "apply",
  "type": "badminton",
  "typeName": "배드민턴",
  "name": "홍길동",
  "gender": "남",
  "age": 34,
  "phone": "010-1234-5678",
  "grade": "C조",
  "experience": "1 ~ 3년",
  "preference": {
    "classKey": "pm_mw",
    "class": "성인 저녁반",
    "days": "월·수",
    "time": "19:30~20:30",
    "coach": "김동욱",
    "price": "월 35만원"
  },
  "region": "서울 금천구 가산동",
  "guardian": null,
  "agreements": { "privacy": true, "notification": true, "guardian": false },
  "clientId": "3f1c2a9e-7b1d-4c55-9a0e-2d6f1e4b8c10",
  "submittedAt": "2026-10-01T09:30:00.000Z",
  "source": "homepage"
}
```
- `age`는 **만 나이**입니다.
- **만 14세 미만**이면 `guardian: { "name": "홍부모", "relation": "모" }`(relation: 부/모/기타 법정대리인)와 `agreements.guardian: true`가 함께 옵니다.
  개인정보 보호법 제22조의2에 따라 법정대리인 동의 기록이므로 반드시 저장해주세요. 14세 이상이면 `guardian: null`.
- `preference.time` / `preference.coach`는 고객이 고르지 않으면 `"상관없음"`입니다.
- `classKey`: `am_mw`(성인 오전반 월·수), `am_tt`(성인 오전반 화·목), `jr_mw`/`jr_tt`(유소년반), `pm_mw`/`pm_tt`(성인 저녁반)
- 유소년반은 보호자 휴대폰 번호가 `phone`에 들어옵니다.
- 배드민턴 `grade` 는 `입문`·`왕초심`·`초심`·`D조`·`C조`·`B조`·`A조` (2026-10-19 — 준자강·자강·선수 출신 뺌). 신청서 03 은 관리프로그램 `GET api?action=bd_slots&grade=` 로 타임마다 '마감'(정원이 찼거나 한 타임 붙은 두 급수·입문 3명 조·타임별 받을 급수가 안 맞음 — 고를 수 없음)·'n월부터'를 표시하고, 반의 모든 타임이 마감이면 반 카드도 마감. 못 받으면 표시 없이 예전처럼(결제 화면이 다시 막음).
- 본문 `test` = 시험 주소(?paytest=1). 결제가 켜져 있으면 관리프로그램은 신청서를 '결제 전'으로 받고 결제가 끝나야 신청으로 보여 줍니다(2026-10-19) — 확인 화면 글도 '결제하면 신청과 등록이 끝나요 · 결제 전에는 접수되지 않아요'.

## 응답
```json
{ "ok": true, "id": "AP261001-003" }
```
- `id`는 신청번호로, 완료 화면에 표시됩니다. 날짜별 일련번호처럼 **겹치지 않게** 만들어주세요.
- 같은 `clientId` 재전송이면 `{ "ok": true, "id": "기존 번호", "duplicate": true }`.
- 실패 시 `{ "ok": false, "error": "invalid" }` → 홈페이지는 "오류, 전화 문의" 안내를 띄웁니다.

## 알림톡 템플릿 초안 (접수 완료)

카카오 알림톡은 템플릿을 미리 검수받아야 하고, `#{변수}` 자리만 바뀝니다.

**배드민턴**
```
[THE SQUARE] 수강신청 접수 완료

#{이름}님, 배드민턴 수강신청이 접수되었습니다.

■ 신청번호: #{신청번호}
■ 희망 반: #{희망반}
■ 희망 시간: #{희망시간}
■ 희망 코치: #{희망코치}

확인 후 담당자가 연락드려 반 배정과 등록을 안내해드리겠습니다.

문의 010-7576-1861
금천구 디지털로 178 A동 2층 E홀
```

변수 매핑:
- `#{희망반}` ← `preference.class + " " + preference.days`
- `#{희망시간}` ← `preference.time`
- `#{희망코치}` ← `preference.coach`

## 연동 후 설정
1. `assets/apply-config.js` → `api: '관리자 프로그램 수강신청 API 주소'`
2. 알림톡이 실제로 나가면 `alimtalk: true`로 바꿔주세요. 완료 화면 문구가 "접수 완료 알림톡이 발송됩니다"로 바뀝니다.
