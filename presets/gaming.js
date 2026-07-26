module.exports = {
  id: 'gaming',
  name: '게임 커뮤니티',
  emoji: '🎮',
  desc: '일반적인 게임 길드 / 클랜용. 공지 · 소통 · 게임별 음성방 구성',
  palette: 'violet',

  roles: [
    { name: '서버장', prefix: '👑', hoist: true, mentionable: false, perms: ['Administrator'] },
    { name: '부서버장', prefix: '⚔️', hoist: true, mentionable: true, perms: ['ManageGuild', 'ManageChannels', 'ManageRoles', 'KickMembers', 'BanMembers', 'ManageMessages', 'MuteMembers', 'MoveMembers'] },
    { name: '관리자', prefix: '🛡️', hoist: true, mentionable: true, perms: ['ManageChannels', 'ManageMessages', 'KickMembers', 'MuteMembers', 'MoveMembers'] },
    { name: '스태프', prefix: '🔧', hoist: true, mentionable: true, perms: ['ManageMessages', 'MuteMembers'] },
    { name: '고인물', prefix: '💎', hoist: true, mentionable: true, perms: [] },
    { name: '멤버', prefix: '🎮', hoist: true, mentionable: false, perms: [] },
    { name: '뉴비', prefix: '🌱', hoist: true, mentionable: false, perms: [] },
    { name: '뮤트', prefix: '🔇', hoist: false, mentionable: false, perms: [], muted: true },
  ],

  categories: [
    {
      name: '📢 안내',
      channels: [
        { name: '공지사항', type: 'announcement', topic: '서버 주요 공지', readOnly: true },
        { name: '서버규칙', type: 'text', topic: '반드시 읽어주세요', readOnly: true },
        { name: '역할받기', type: 'text', topic: '원하는 역할을 선택하세요', readOnly: true },
        { name: '업데이트', type: 'text', topic: '변경 사항 기록', readOnly: true },
      ],
    },
    {
      name: '💬 소통',
      channels: [
        { name: '자유채팅', type: 'text', topic: '자유롭게 대화하는 곳', slowmode: 3 },
        { name: '인사', type: 'text', topic: '새로 오신 분 환영합니다' },
        { name: '스크린샷', type: 'text', topic: '게임 스크린샷 · 클립 공유' },
        { name: '봇명령어', type: 'text', topic: '봇 명령어는 여기서' },
        { name: '건의사항', type: 'text', topic: '서버에 바라는 점' },
      ],
    },
    {
      name: '🕹️ 게임',
      channels: [
        { name: '파티모집', type: 'text', topic: '같이 할 사람 구합니다' },
        { name: '공략정보', type: 'text', topic: '팁 · 공략 공유' },
        { name: '🔊 로비', type: 'voice' },
        { name: '🔊 게임방-1', type: 'voice', limit: 5 },
        { name: '🔊 게임방-2', type: 'voice', limit: 5 },
        { name: '🔊 게임방-3', type: 'voice', limit: 5 },
        { name: '🔊 듀오', type: 'voice', limit: 2 },
      ],
    },
    {
      name: '🎧 휴식',
      channels: [
        { name: '🔊 노래방', type: 'voice', limit: 10 },
        { name: '🔊 수다방', type: 'voice' },
        { name: '🔊 잠수방', type: 'voice' },
        { name: '🔊 1:1 상담', type: 'voice', limit: 2 },
      ],
    },
    {
      name: '🛠️ 스태프',
      private: true,
      allow: ['서버장', '부서버장', '관리자', '스태프'],
      channels: [
        { name: '스태프채팅', type: 'text', topic: '운영진 전용' },
        { name: '신고접수', type: 'text', topic: '신고 처리 기록' },
        { name: '로그', type: 'text', topic: '봇 로그 출력' },
        { name: '🔊 회의실', type: 'voice' },
      ],
    },
  ],
};
