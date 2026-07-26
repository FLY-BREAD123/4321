module.exports = {
  id: 'minecraft',
  name: '마인크래프트 서버',
  emoji: '⛏️',
  desc: '마크 서버용. 서버 정보 · 건축/자원 채널 · 국가전 채널 포함',
  palette: 'forest',

  roles: [
    { name: '서버장', prefix: '👑', hoist: true, mentionable: false, perms: ['Administrator'] },
    { name: '관리자', prefix: '🛡️', hoist: true, mentionable: true, perms: ['ManageGuild', 'ManageChannels', 'ManageRoles', 'KickMembers', 'BanMembers', 'ManageMessages', 'MuteMembers'] },
    { name: '개발자', prefix: '💻', hoist: true, mentionable: true, perms: ['ManageChannels', 'ManageMessages'] },
    { name: '스태프', prefix: '🔧', hoist: true, mentionable: true, perms: ['ManageMessages', 'MuteMembers'] },
    { name: '건축가', prefix: '🏰', hoist: true, mentionable: true, perms: [] },
    { name: '국왕', prefix: '⚜️', hoist: true, mentionable: true, perms: [] },
    { name: '후원자', prefix: '💎', hoist: true, mentionable: false, perms: [] },
    { name: '유저', prefix: '⛏️', hoist: true, mentionable: false, perms: [] },
    { name: '뮤트', prefix: '🔇', hoist: false, mentionable: false, perms: [], muted: true },
  ],

  categories: [
    {
      name: '📢 서버정보',
      channels: [
        { name: '공지사항', type: 'announcement', readOnly: true },
        { name: '서버규칙', type: 'text', readOnly: true },
        { name: '접속주소', type: 'text', topic: 'IP · 버전 안내', readOnly: true },
        { name: '패치노트', type: 'text', readOnly: true },
        { name: '명령어안내', type: 'text', topic: '인게임 명령어 목록', readOnly: true },
      ],
    },
    {
      name: '💬 커뮤니티',
      channels: [
        { name: '자유채팅', type: 'text', slowmode: 3 },
        { name: '인게임채팅', type: 'text', topic: '서버 <-> 디코 채팅 연동', readOnly: true },
        { name: '건축자랑', type: 'text', topic: '내 건축물 스크린샷' },
        { name: '거래장터', type: 'text', topic: '아이템 · 상점 홍보' },
        { name: '건의사항', type: 'text' },
        { name: '버그제보', type: 'text' },
        { name: '봇명령어', type: 'text' },
      ],
    },
    {
      name: '⚔️ 국가/전쟁',
      channels: [
        { name: '국가모집', type: 'text', topic: '국가원 모집 공고' },
        { name: '전쟁선포', type: 'text', topic: '선전포고 기록' },
        { name: '동맹', type: 'text', topic: '동맹 · 조약 협상' },
        { name: '🔊 국가회의', type: 'voice' },
      ],
    },
    {
      name: '🎧 음성',
      channels: [
        { name: '🔊 로비', type: 'voice' },
        { name: '🔊 같이하기-1', type: 'voice', limit: 6 },
        { name: '🔊 같이하기-2', type: 'voice', limit: 6 },
        { name: '🔊 건축작업', type: 'voice' },
        { name: '🔊 잠수방', type: 'voice' },
      ],
    },
    {
      name: '🛠️ 운영진',
      private: true,
      allow: ['서버장', '관리자', '개발자', '스태프'],
      channels: [
        { name: '운영채팅', type: 'text' },
        { name: '신고처리', type: 'text' },
        { name: '플러그인개발', type: 'text', topic: '플러그인 작업 로그' },
        { name: '콘솔로그', type: 'text' },
        { name: '🔊 운영회의', type: 'voice' },
      ],
    },
  ],
};
