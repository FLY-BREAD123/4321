module.exports = {
  id: 'community',
  name: '친목 커뮤니티',
  emoji: '🍻',
  desc: '소규모 친목방. 채널 수를 줄이고 음성방 위주로 가볍게 구성',
  palette: 'pastel',

  roles: [
    { name: '방장', prefix: '👑', hoist: true, mentionable: false, perms: ['Administrator'] },
    { name: '부방장', prefix: '⭐', hoist: true, mentionable: true, perms: ['ManageChannels', 'ManageMessages', 'KickMembers', 'MuteMembers', 'MoveMembers'] },
    { name: '터줏대감', prefix: '🌸', hoist: true, mentionable: false, perms: [] },
    { name: '멤버', prefix: '🫧', hoist: true, mentionable: false, perms: [] },
    { name: '새싹', prefix: '🌱', hoist: true, mentionable: false, perms: [] },
    { name: '뮤트', prefix: '🔇', hoist: false, mentionable: false, perms: [], muted: true },
  ],

  categories: [
    {
      name: '🌷 시작하기',
      channels: [
        { name: '공지', type: 'text', readOnly: true },
        { name: '규칙', type: 'text', readOnly: true },
        { name: '자기소개', type: 'text', topic: '간단하게 소개해주세요' },
      ],
    },
    {
      name: '💬 수다',
      channels: [
        { name: '자유채팅', type: 'text' },
        { name: '오늘뭐함', type: 'text', topic: '일상 공유' },
        { name: '사진첩', type: 'text', topic: '아무 사진이나' },
        { name: '음악추천', type: 'text' },
        { name: '봇놀이', type: 'text' },
      ],
    },
    {
      name: '🎧 음성',
      channels: [
        { name: '🔊 다같이', type: 'voice' },
        { name: '🔊 소곤소곤', type: 'voice', limit: 4 },
        { name: '🔊 둘이서', type: 'voice', limit: 2 },
        { name: '🔊 잠수', type: 'voice' },
      ],
    },
    {
      name: '🔒 운영',
      private: true,
      allow: ['방장', '부방장'],
      channels: [
        { name: '운영진방', type: 'text' },
        { name: '로그', type: 'text' },
      ],
    },
  ],
};
