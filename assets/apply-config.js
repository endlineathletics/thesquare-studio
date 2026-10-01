/* ============================================================
   수강신청 설정
   - api:  신청서를 받을 주소 (POST, JSON). 형식은 docs/apply-api.md 참고.
           · 지금은 THE SQUARE 관리프로그램(thesquare-admin)의 /api/site (관리자 > 수강신청 화면으로 들어감).
           · 비워두면 신청 내용을 복사해 전화/DM으로 보내도록 안내합니다.
   - alimtalk: 접수 후 카카오 알림톡이 실제로 발송될 때 true 로 바꿔주세요.
               (완료 화면 문구가 "알림톡으로 안내됩니다"로 바뀝니다)
   ============================================================ */
window.APPLY = {
  api: 'https://thesquare-admin-production.up.railway.app/api/site',
  alimtalk: false,
  phone: '02-6956-1861',
  instagram: 'https://www.instagram.com/the__square_studio/',
};
