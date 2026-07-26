const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const UI = require('../lib/ui');
const { PRESETS, stats } = require('../presets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('이 봇의 사용법을 봅니다')
    .setDMPermission(false),

  async execute(interaction) {
    const presetList = Object.values(PRESETS)
      .map((p) => {
        const s = stats(p);
        return `${p.emoji} **${p.name}** — 카테고리 ${s.categories} · 채널 ${s.text + s.voice} · 역할 ${s.roles}`;
      })
      .join('\n');

    const e = UI.embed(
      '📖 서버 관리 봇',
      '서버 세팅부터 환영 메시지 · 공지 · 티켓 · 통계까지 한 번에.',
    );

    e.addFields(
      {
        name: '🏗️ 서버 구축',
        value:
          '`/서버세팅` 프리셋으로 카테고리·채널·역할·색상·권한 통째로 생성\n' +
          '`/미리보기` 만들어질 구조를 미리 확인 (나만 보임)\n' +
          '`/색상팔레트` 기존 역할들 색상을 자동으로 재배분\n' +
          '`/방추가` 텍스트방·음성방을 여러 개 한 번에 생성',
      },
      {
        name: '👋 환영 · 자동역할',
        value:
          '`/환영설정 입장` 새 멤버 입장 메시지 + 자동 역할 지급\n' +
          '`/환영설정 퇴장` 멤버 퇴장 메시지\n' +
          '`/환영설정 테스트` 설정한 메시지 미리보기\n' +
          '변수: `{유저}` `{이름}` `{서버}` `{인원}`',
      },
      {
        name: '📢 공지 · 티켓 · 통계',
        value:
          '`/공지` 임베드 공지를 폼으로 작성해 전송\n' +
          '`/티켓 설치` 문의하기 버튼 패널 설치 (비공개 채널 자동 생성)\n' +
          '`/통계채널 설치` 멤버수를 음성 채널 이름으로 실시간 표시',
      },
      {
        name: '📦 프리셋',
        value: presetList,
      },
      {
        name: '⚙️ 필요한 봇 권한',
        value:
          '`채널 관리` `역할 관리` `메시지 보내기`\n' +
          '역할 색상·자동역할을 쓰려면 봇 역할을 **역할 목록 위쪽**에 두세요.\n' +
          '환영/통계 기능은 개발자 포털에서 **Server Members Intent** 를 켜야 합니다.',
      },
    );

    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  },
};
