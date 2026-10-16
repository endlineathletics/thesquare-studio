/* ============================================================
   수강신청 설정
   - api:  신청서를 받을 주소 (POST, JSON). 형식은 docs/apply-api.md 참고.
           · 지금은 THE SQUARE 관리프로그램(thesquare-admin)의 /api/site (관리자 > 수강신청 화면으로 들어감).
           · 비워두면 신청 내용을 복사해 전화/DM으로 보내도록 안내합니다.
   - paySdk: 나이스페이 결제창 JS SDK 주소 (2026-10 수강신청 카드 결제 — 신청 확인 화면에서 관리프로그램이 금액을 정하고 결제창을 연다).
             결제를 켜고 끄는 것은 관리프로그램 > 설정 '수강 온라인 결제'(켜기 전엔 주소에 ?paytest=1 을 붙여 시험).
             결제가 꺼져 있으면 확인 화면은 '확인 후 담당자가 연락' 안내만 보여요.
   - alimtalk: 접수 후 카카오 알림톡이 실제로 발송될 때 true 로 바꿔주세요.
               (완료 화면 문구가 "알림톡으로 안내됩니다"로 바뀝니다)
   ============================================================ */
window.APPLY = {
  api: 'https://thesquare-admin-production.up.railway.app/api/site',
  paySdk: 'https://pay.nicepay.co.kr/v1/js/',   // 운영·샌드박스 같은 주소 (모드는 관리프로그램 키가 정함 — booking-config.js 와 같음)
  payMethod: 'card',
  alimtalk: false,
  phone: { badminton: '010-7576-1861', yoga: '010-7569-1861' },   // 종목별 문의 번호 (body[data-apply] 로 선택)
  instagram: 'https://www.instagram.com/the__square_studio/',
};
