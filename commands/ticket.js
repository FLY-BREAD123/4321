const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const C = require('../config');
const UI = require('../lib/ui');
const store = require('../lib/store');

const P = PermissionFlagsBits;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('티켓')
    .setDescription('문의 티켓 시스템을 설정합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    // ── 패널 설치 ──
    .addSubcommand((s) =>
      s
        .setName('설치')
        .setDescription('문의하기 버튼 패널을 이 채널에 설치합니다')
        .addRoleOption((o) =>
          o
            .setName('담당역할')
            .setDescription('티켓을 볼 수 있는 스태프 역할')
            .setRequired(true),
        )
        .addChannelOption((o) =>
          o
            .setName('카테고리')
            .setDescription('티켓 채널이 생성될 카테고리 (없으면 자동 생성)')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        )
        .addStringOption((o) =>
          o.setName('제목').setDescription('패널 제목 (기본: 문의하기)').setRequired(false),
        )
        .addStringOption((o) =>
          o.setName('설명').setDescription('패널 설명 문구').setRequired(false),
        )
        .addStringOption((o) =>
          o.setName('버튼이름').setDescription('버튼에 표시할 글자 (기본: 문의하기)').setRequired(false),
        ),
    )
    // ── 로그 채널 ──
    .addSubcommand((s) =>
      s
        .setName('로그')
        .setDescription('닫힌 티켓 기록을 남길 채널을 설정')
        .addChannelOption((o) =>
          o
            .setName('채널')
            .setDescription('로그 채널')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guild.id;

    // ───────── 로그 설정 ─────────
    if (sub === '로그') {
      const channel = interaction.options.getChannel('채널');
      store.set(gid, 'ticket.logChannel', channel.id);
      return interaction.reply({
        embeds: [UI.embed('✅ 티켓 로그 설정', `닫힌 티켓은 ${channel} 에 기록됩니다.`, C.SUCCESS)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ───────── 패널 설치 ─────────
    const staffRole = interaction.options.getRole('담당역할');
    let category = interaction.options.getChannel('카테고리');
    const title = interaction.options.getString('제목') || '문의하기';
    const desc =
      interaction.options.getString('설명') ||
      '아래 버튼을 누르면 운영진과 1:1로 대화할 수 있는 비공개 채널이 만들어집니다.';
    const btnLabel = interaction.options.getString('버튼이름') || '문의하기';

    // 봇 권한 체크
    const me = interaction.guild.members.me;
    if (!me.permissions.has(P.ManageChannels)) {
      return interaction.reply({
        embeds: [UI.embed('❌ 권한 없음', '봇에게 **채널 관리** 권한이 필요합니다.', C.DANGER)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // 카테고리 없으면 만들기
    if (!category) {
      try {
        category = await interaction.guild.channels.create({
          name: '🎫 티켓',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [P.ViewChannel] },
            { id: staffRole.id, allow: [P.ViewChannel] },
            { id: me.id, allow: [P.ViewChannel, P.ManageChannels] },
          ],
        });
      } catch {
        category = null; // 실패해도 채널은 카테고리 없이 생성됨
      }
    }

    // 설정 저장
    store.set(gid, 'ticket.staffRole', staffRole.id);
    store.set(gid, 'ticket.category', category?.id ?? null);
    store.set(gid, 'ticket.counter', store.get(gid, 'ticket.counter', 0));

    // 패널 임베드 + 버튼
    const panel = new EmbedBuilder()
      .setColor(C.BRAND)
      .setTitle(`🎫 ${title}`)
      .setDescription(desc)
      .setFooter({ text: '버튼은 한 번만 눌러주세요' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:open')
        .setLabel(btnLabel)
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.channel.send({ embeds: [panel], components: [row] });
    return interaction.reply({
      embeds: [
        UI.embed(
          '✅ 티켓 패널 설치 완료',
          `담당 역할 ${staffRole}\n` +
            (category ? `티켓 위치 ${category}\n` : '') +
            '유저가 버튼을 누르면 비공개 채널이 생성됩니다.',
          C.SUCCESS,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },

  // ── 버튼 인터랙션 (index.js 에서 라우팅) ──
  async handleButton(interaction) {
    const [, action] = interaction.customId.split(':');

    if (action === 'open') return openTicket(interaction);
    if (action === 'close') return askClose(interaction);
    if (action === 'confirmclose') return closeTicket(interaction);
    if (action === 'cancelclose') {
      return interaction.update({
        content: '닫기를 취소했습니다.',
        embeds: [],
        components: [],
      });
    }
  },
};

/** 티켓 채널 생성 */
async function openTicket(interaction) {
  const gid = interaction.guild.id;
  const cfg = store.get(gid, 'ticket');
  if (!cfg?.staffRole) {
    return interaction.reply({
      content: '⚠️ 티켓 설정이 초기화되었습니다. 관리자에게 문의해주세요.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // 이미 열린 티켓이 있는지 확인 (채널 토픽에 유저 ID 저장)
  const existing = interaction.guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.topic === `ticket:${interaction.user.id}`,
  );
  if (existing) {
    return interaction.reply({
      content: `이미 열려있는 티켓이 있습니다: ${existing}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const me = interaction.guild.members.me;
  const num = store.get(gid, 'ticket.counter', 0) + 1;
  store.set(gid, 'ticket.counter', num);

  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [P.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles],
    },
    {
      id: cfg.staffRole,
      allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.ManageMessages],
    },
    { id: me.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels, P.ReadMessageHistory] },
  ];

  let channel;
  try {
    channel = await interaction.guild.channels.create({
      name: `티켓-${String(num).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: cfg.category || undefined,
      topic: `ticket:${interaction.user.id}`,
      permissionOverwrites: overwrites,
      reason: `티켓 생성 - ${interaction.user.tag}`,
    });
  } catch (err) {
    return interaction.editReply({
      content: `❌ 티켓 채널을 만들지 못했습니다.\n\`${err.message}\``,
    });
  }

  const welcome = new EmbedBuilder()
    .setColor(C.BRAND)
    .setTitle(`🎫 티켓 #${num}`)
    .setDescription(
      `${interaction.user} 님, 문의 내용을 남겨주세요.\n` +
        `<@&${cfg.staffRole}> 담당자가 곧 확인합니다.\n\n` +
        '용무가 끝나면 아래 **티켓 닫기** 버튼을 눌러주세요.',
    )
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('티켓 닫기')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );

  await channel.send({
    content: `${interaction.user} <@&${cfg.staffRole}>`,
    embeds: [welcome],
    components: [closeRow],
    allowedMentions: { users: [interaction.user.id], roles: [cfg.staffRole] },
  });

  await interaction.editReply({ content: `✅ 티켓이 생성되었습니다: ${channel}` });
}

/** 닫기 확인 버튼 표시 */
async function askClose(interaction) {
  const confirm = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:confirmclose')
      .setLabel('닫기 확인')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:cancelclose')
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary),
  );
  await interaction.reply({
    content: '이 티켓을 닫을까요? 채널이 삭제됩니다.',
    components: [confirm],
    flags: MessageFlags.Ephemeral,
  });
}

/** 티켓 닫기 - 로그 남기고 채널 삭제 */
async function closeTicket(interaction) {
  const gid = interaction.guild.id;
  const channel = interaction.channel;

  // 담당 역할 또는 채널 관리 권한자만 닫을 수 있게
  const cfg = store.get(gid, 'ticket');
  const member = interaction.member;
  const canClose =
    member.permissions.has(P.ManageChannels) ||
    (cfg?.staffRole && member.roles.cache.has(cfg.staffRole)) ||
    channel.topic === `ticket:${interaction.user.id}`; // 본인
  if (!canClose) {
    return interaction.update({
      content: '⚠️ 티켓을 닫을 권한이 없습니다.',
      components: [],
    });
  }

  await interaction.update({ content: '🔒 티켓을 닫는 중...', components: [] });

  // 로그 남기기
  const logId = store.get(gid, 'ticket.logChannel');
  if (logId) {
    const logCh = interaction.guild.channels.cache.get(logId);
    if (logCh) {
      const openerId = channel.topic?.replace('ticket:', '');
      const log = new EmbedBuilder()
        .setColor(C.WARN)
        .setTitle('🎫 티켓 종료')
        .addFields(
          { name: '티켓', value: channel.name, inline: true },
          { name: '작성자', value: openerId ? `<@${openerId}>` : '알 수 없음', inline: true },
          { name: '닫은 사람', value: `${interaction.user}`, inline: true },
        )
        .setTimestamp();
      logCh.send({ embeds: [log] }).catch(() => {});
    }
  }

  // 5초 후 삭제 (마지막 메시지 읽을 시간)
  await channel.send({
    embeds: [UI.embed('🔒 티켓 종료', '5초 후 이 채널이 삭제됩니다.', C.WARN)],
  });
  setTimeout(() => {
    channel.delete('티켓 종료').catch(() => {});
  }, 5000);
}
