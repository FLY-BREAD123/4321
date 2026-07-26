const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const C = require('../config');
const UI = require('../lib/ui');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('방추가')
    .setDescription('텍스트방 · 음성방을 원하는 개수만큼 한 번에 만듭니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('종류')
        .setDescription('만들 채널 종류')
        .setRequired(true)
        .addChoices(
          { name: '💬 텍스트 채널', value: 'text' },
          { name: '🔊 음성 채널', value: 'voice' },
        ),
    )
    .addStringOption((o) =>
      o
        .setName('이름')
        .setDescription('채널 이름. 쉼표로 여러 개 가능 (예: 게임방, 수다방)')
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName('카테고리')
        .setDescription('넣을 카테고리 이름 (없으면 새로 만듭니다)')
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('개수')
        .setDescription('이름 뒤에 번호를 붙여 이 개수만큼 복제합니다 (1~25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false),
    )
    .addIntegerOption((o) =>
      o
        .setName('인원')
        .setDescription('음성방 인원 제한 (1~99)')
        .setMinValue(1)
        .setMaxValue(99)
        .setRequired(false),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const cats = interaction.guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory)
      .filter((c) => c.name.toLowerCase().includes(focused))
      .first(25)
      .map((c) => ({ name: c.name.slice(0, 100), value: c.name.slice(0, 100) }));
    await interaction.respond(cats);
  },

  async execute(interaction) {
    const kind = interaction.options.getString('종류');
    const rawNames = interaction.options.getString('이름');
    const catName = interaction.options.getString('카테고리');
    const count = interaction.options.getInteger('개수');
    const limit = interaction.options.getInteger('인원');

    const isVoice = kind === 'voice';
    const type = isVoice ? ChannelType.GuildVoice : ChannelType.GuildText;

    // 이름 목록 만들기
    let names = rawNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (count && count > 1) {
      const base = names[0];
      names = Array.from({ length: count }, (_, i) => `${base}-${i + 1}`);
    }

    if (names.length === 0) {
      return interaction.reply({
        embeds: [UI.embed('❌ 오류', '만들 채널 이름이 없습니다.', C.DANGER)],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    // 카테고리 찾기 / 만들기
    let parent = null;
    if (catName) {
      parent = interaction.guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === catName,
      );
      if (!parent) {
        try {
          parent = await interaction.guild.channels.create({
            name: catName,
            type: ChannelType.GuildCategory,
            reason: '방추가 - 카테고리 자동 생성',
          });
          await sleep(C.CREATE_DELAY);
        } catch {
          parent = null;
        }
      }
    }

    const created = [];
    const failed = [];

    for (const name of names) {
      const finalName = isVoice && !/^[\p{Emoji}]/u.test(name) ? `🔊 ${name}` : name;
      try {
        const payload = { name: finalName, type, reason: '방추가 명령' };
        if (parent) payload.parent = parent.id;
        if (isVoice && limit) payload.userLimit = limit;
        const ch = await interaction.guild.channels.create(payload);
        created.push(ch.toString());
        await sleep(C.CREATE_DELAY);
      } catch (err) {
        failed.push(`${name} — ${err?.code === 50013 ? '권한 부족' : '실패'}`);
      }
    }

    const e = UI.embed(
      failed.length ? '⚠️ 일부만 생성됨' : '✅ 생성 완료',
      `${isVoice ? '🔊 음성' : '💬 텍스트'} 채널 **${created.length}개**를 만들었습니다.` +
        (parent ? `\n📁 위치: **${parent.name}**` : '') +
        (isVoice && limit ? `\n👥 인원 제한: **${limit}명**` : ''),
      failed.length ? C.WARN : C.SUCCESS,
    );
    if (created.length) {
      e.addFields({ name: '만들어진 채널', value: created.join(' ').slice(0, 1024) });
    }
    if (failed.length) {
      e.addFields({ name: '❌ 실패', value: failed.join('\n').slice(0, 1024) });
    }

    await interaction.editReply({ embeds: [e] });
  },
};
