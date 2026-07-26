module.exports = {
  id: 'study',
  name: '스터디 / 작업방',
  emoji: '📚',
  desc: '공부 · 개발 · 작업용. 집중 음성방과 인증 채널 중심',
  palette: 'ocean',

  roles: [
    { name: '운영자', prefix: '👑', hoist: true, mentionable: false, perms: ['Administrator'] },
    { name: '조교', prefix: '📌', hoist: true, mentionable: true, perms: ['ManageChannels', 'ManageMessages', 'MuteMembers', 'MoveMembers'] },
    { name: '개근왕', prefix: '🏅', hoist: true, mentionable: false, perms: [] },
    { name: '스터디원', prefix: '📖', hoist: true, mentionable: false, perms: [] },
    { name: '청강생', prefix: '👀', hoist: true, mentionable: false, perms: [] },
    { name: '뮤트', prefix: '🔇', hoist: false, mentionable: false, perms: [], muted: true },
  ],

  categories: [
    {
      name: '📋 안내',
      channels: [
        { name: '공지사항', type: 'text', readOnly: true },
        { name: '스터디규칙', type: 'text', readOnly: true },
        { name: '일정표', type: 'text', topic: '주차별 진도 · 일정', readOnly: true },
      ],
    },
    {
      name: '✅ 인증',
      channels: [
        { name: '출석체크', type: 'text', topic: '매일 출석 남기기' },
        { name: '오늘의목표', type: 'text', topic: '아침에 목표 선언' },
        { name: '공부인증', type: 'text', topic: '사진 · 스크린샷 인증' },
        { name: '회고', type: 'text', topic: '주간 회고 작성' },
      ],
    },
    {
      name: '💬 소통',
      channels: [
        { name: '질문답변', type: 'text', topic: '막히는 부분 질문' },
        { name: '자료공유', type: 'text', topic: '링크 · 파일 공유' },
        { name: '잡담', type: 'text' },
        { name: '봇명령어', type: 'text' },
      ],
    },
    {
      name: '🎧 집중',
      channels: [
        { name: '🔊 집중방-1', type: 'voice', limit: 8 },
        { name: '🔊 집중방-2', type: 'voice', limit: 8 },
        { name: '🔊 캠스터디', type: 'voice', limit: 6 },
        { name: '🔊 질문방', type: 'voice', limit: 4 },
        { name: '🔊 쉬는시간', type: 'voice' },
      ],
    },
    {
      name: '🔒 운영',
      private: true,
      allow: ['운영자', '조교'],
      channels: [
        { name: '운영채팅', type: 'text' },
        { name: '출석통계', type: 'text' },
      ],
    },
  ],
};
