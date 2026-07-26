// 봇 전역 설정
module.exports = {
  // 임베드 브랜드 색상
  BRAND: 0xb478ff,
  BRAND_SUB: 0x8a5cf6,
  SUCCESS: 0x4ade80,
  WARN: 0xfacc15,
  DANGER: 0xf87171,

  // 채널/역할 생성 간 딜레이(ms) - 레이트리밋 회피
  CREATE_DELAY: 320,

  // 진행률 메시지 갱신 주기 (몇 개마다 한 번)
  PROGRESS_EVERY: 4,

  // 확인 버튼 대기 시간(ms)
  CONFIRM_TIMEOUT: 60_000,

  // 디스코드 한도
  LIMIT_CHANNELS: 500,
  LIMIT_ROLES: 250,
};
