module.exports = {
  id: 'fivem',
  name: 'FiveM 로플 서버',
  emoji: '🚔',
  desc: 'GTA5 로플 서버 전용. 직업별 채널 · 인게임 문의 · 상황실 구성',
  palette: 'neon',

  roles: [
    { name: '서버장', prefix: '👑', hoist: true, mentionable: false, perms: ['Administrator'] },
    { name: '총괄', prefix: '🎬', hoist: true, mentionable: true, perms: ['ManageGuild', 'ManageChannels', 'ManageRoles', 'KickMembers', 'BanMembers', 'ManageMessages', 'MuteMembers', 'MoveMembers'] },
    { name: '운영진', prefix: '🛡️', hoist: true, mentionable: true, perms: ['ManageChannels', 'ManageMessages', 'KickMembers', 'MuteMembers', 'MoveMembers'] },
    { name: '개발팀', prefix: '💻', hoist: true, mentionable: true, perms: ['ManageChannels', 'ManageMessages'] },
    { name: '경찰', prefix: '🚓', hoist: true, mentionable: true, perms: [] },
    { name: '소방/구급', prefix: '🚑', hoist: true, mentionable: true, perms: [] },
    { name: '정비소', prefix: '🔧', hoist: true, mentionable: true, perms: [] },
    { name: '조직', prefix: '🔫', hoist: true, mentionable: true, perms: [] },
    { name: '시민', prefix: '👤', hoist: true, mentionable: false, perms: [] },
    { name: '면접대기', prefix: '📝', hoist: true, mentionable: false, perms: [] },
    { name: '뮤트', prefix: '🔇', hoist: false, mentionable: false, perms: [], muted: true },
  ],

  categories: [
    {
      name: '📢 서버안내',
      channels: [
        { name: '공지사항', type: 'announcement', topic: '서버 공지', readOnly: true },
        { name: '서버규칙', type: 'text', topic: '로플 규칙 · 메타 금지 항목', readOnly: true },
        { name: '접속방법', type: 'text', topic: 'connect 정보 · 필수 설치', readOnly: true },
        { name: '패치노트', type: 'text', topic: '업데이트 내역', readOnly: true },
        { name: '서버상태', type: 'text', topic: '오픈 · 점검 알림', readOnly: true },
      ],
    },
    {
      name: '📝 가입/신청',
      channels: [
        { name: '가입신청', type: 'text', topic: '양식에 맞춰 작성해주세요' },
        { name: '직업신청', type: 'text', topic: '경찰 · 소방 · 정비소 지원' },
        { name: '조직신청', type: 'text', topic: '조직 창설 · 가입 신청' },
        { name: '차량등록', type: 'text', topic: '커스텀 차량 신청' },
      ],
    },
    {
      name: '💬 커뮤니티',
      channels: [
        { name: '자유채팅', type: 'text', topic: 'OOC 자유 대화', slowmode: 3 },
        { name: '인증사진', type: 'text', topic: '인게임 스샷 · 클립' },
        { name: '거래장터', type: 'text', topic: '인게임 아이템 · 차량 거래' },
        { name: '건의사항', type: 'text', topic: '서버 개선 제안' },
        { name: '버그제보', type: 'text', topic: '재현 방법까지 적어주세요' },
        { name: '봇명령어', type: 'text', topic: '봇 전용' },
      ],
    },
    {
      name: '🎙️ 대기실',
      channels: [
        { name: '🔊 접속대기', type: 'voice' },
        { name: '🔊 자유통화-1', type: 'voice' },
        { name: '🔊 자유통화-2', type: 'voice' },
        { name: '🔊 잠수방', type: 'voice' },
      ],
    },
    {
      name: '🚓 공무원',
      private: true,
      allow: ['서버장', '총괄', '운영진', '경찰', '소방/구급'],
      channels: [
        { name: '공무원공지', type: 'text', topic: '근무 지침', readOnly: true },
        { name: '상황보고', type: 'text', topic: '출동 · 사건 기록' },
        { name: '🔊 상황실', type: 'voice' },
        { name: '🔊 순찰-1', type: 'voice', limit: 4 },
        { name: '🔊 순찰-2', type: 'voice', limit: 4 },
      ],
    },
    {
      name: '🎭 조직',
      private: true,
      allow: ['서버장', '총괄', '운영진', '조직'],
      channels: [
        { name: '조직공지', type: 'text', readOnly: true },
        { name: '조직채팅', type: 'text' },
        { name: '🔊 아지트', type: 'voice' },
      ],
    },
    {
      name: '🛠️ 운영진',
      private: true,
      allow: ['서버장', '총괄', '운영진', '개발팀'],
      channels: [
        { name: '운영채팅', type: 'text' },
        { name: '신고처리', type: 'text', topic: '신고 접수 및 처리 내역' },
        { name: '제재기록', type: 'text', topic: '경고 · 밴 로그' },
        { name: '개발작업', type: 'text', topic: '리소스 개발 진행 상황' },
        { name: '서버로그', type: 'text', topic: '봇 · 서버 로그' },
        { name: '🔊 운영회의', type: 'voice' },
        { name: '🔊 면접실', type: 'voice', limit: 3 },
      ],
    },
  ],
};
