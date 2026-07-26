const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const C = require('../config');
const UI = require('../lib/ui');
const store = require('../lib/store');

const P = PermissionFlagsBits;

// 사용 가능한 통계 종류
const STAT_TYPES = {
  members: { label: '전체 멤버', emoji: '👥', fmt: (g) => g.memberCount },
  humans: {
    label: '유저 (봇 제외)',
    emoji: '🧑',
    fmt: (g) => g.members.cache.filter((m) => !m.user.bot).size || g.memberCount,
  },
  bots: {
    label: '봇',
    emoji: '🤖',
    fmt: (g) => g.members.cache.filter((m) => m.user.bot).size,
  },
  online: {
    label: '온라인',
    emoji: '🟢',
    fmt: (g) =>
      g.members.cache.filter(
        (m) => m.presence && m.presence.status !== 'offline',
      ).size,
  },
  boosts: { label: '부스트', emoji: '🚀', fmt: (g) => g.premiumSubscriptionCount ?? 0 },
  roles: { label: '역할', emoji: '🎭', fmt: (g) => g.roles.cache.size - 1 },
  channels: {
    label: '채널',
    emoji: '📁',
    fmt: (g) => g.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory).size,
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('통계채널')
    .setDescription('서버 인원수를 음성 채널 이름으로 실시간 표시합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    // ── 추가 ──
    .addSubcommand((s) =>
      s
        .setName('추가')
        .setDescription('통계 채널을 하나 만듭니다')
        .addStringOption((o) =>
          o
            .setName('종류')
            .setDescription('표시할 통계')
            .setRequired(true)
            .addChoices(
              ...Object.entries(STAT_TYPES).map(([v, t]) => ({
                name: `${t.emoji} ${t.label}`,
                value: v,
              })),
            ),
        )
        .addStringOption((o) =>
          o
            .setName('형식')
            .setDescription('이름 형식. {수} 자리에 숫자가 들어감 (기본: "종류: {수}")')
            .setRequired(false),
        ),
    )
    // ── 전체 설치 ──
    .addSubcommand((s) =>
      s
        .setName('설치')
        .setDescription('자주 쓰는 통계 채널들을 한 번에 만듭니다 (멤버·유저·봇·부스트)'),
    )
    // ── 갱신 ──
    .addSubcommand((s) =>
      s.setName('갱신').setDescription('지금 즉시 통계 채널을 최신 숫자로 갱신합니다'),
    )
    // ── 제거 ──
    .addSubcommand((s) =>
      s.setName('제거').setDescription('모든 통계 채널을 삭제합니다'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guild.id;
    const me = interaction.guild.members.me;

    if (!me.permissions.has(P.ManageChannels)) {
      return interaction.reply({
        embeds: [UI.embed('❌ 권한 없음', '봇에게 **채널 관리** 권한이 필요합니다.', C.DANGER)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ───────── 추가 ─────────
    if (sub === '추가') {
      const type = interaction.options.getString('종류');
      const t = STAT_TYPES[type];
      const format =
        interaction.options.getString('형식') || `${t.emoji} ${t.label}: {수}`;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const parent = await ensureCategory(interaction.guild);
      const value = safeCount(t, interaction.guild);
      const name = format.replaceAll('{수}', value).slice(0, 100);

      let channel;
      try {
        channel = await interaction.guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: parent?.id,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [P.Connect] },
          ],
          reason: '통계 채널 생성',
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ 생성 실패: \`${err.message}\`` });
      }

      const list = store.get(gid, 'statChannels', []);
      list.push({ id: channel.id, type, format });
      store.set(gid, 'statChannels', list);

      return interaction.editReply({
        content: `✅ 통계 채널 생성: **${name}**\n숫자는 약 10분마다 자동 갱신됩니다.`,
      });
    }

    // ───────── 전체 설치 ─────────
    if (sub === '설치') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const parent = await ensureCategory(interaction.guild);
      const presets = [
        { type: 'members', format: '👥 전체: {수}' },
        { type: 'humans', format: '🧑 유저: {수}' },
        { type: 'bots', format: '🤖 봇: {수}' },
        { type: 'boosts', format: '🚀 부스트: {수}' },
      ];

      const list = store.get(gid, 'statChannels', []);
      const made = [];
      for (const p of presets) {
        const t = STAT_TYPES[p.type];
        const value = safeCount(t, interaction.guild);
        const name = p.format.replaceAll('{수}', value).slice(0, 100);
        try {
          const ch = await interaction.guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: parent?.id,
            permissionOverwrites: [
              { id: interaction.guild.roles.everyone.id, deny: [P.Connect] },
            ],
            reason: '통계 채널 일괄 생성',
          });
          list.push({ id: ch.id, type: p.type, format: p.format });
          made.push(name);
          await new Promise((r) => setTimeout(r, 350));
        } catch {
          /* 개별 실패 무시 */
        }
      }
      store.set(gid, 'statChannels', list);

      return interaction.editReply({
        content:
          `✅ 통계 채널 **${made.length}개** 생성:\n` +
          made.map((m) => `• ${m}`).join('\n') +
          '\n\n숫자는 약 10분마다 자동 갱신됩니다.',
      });
    }

    // ───────── 갱신 ─────────
    if (sub === '갱신') {
      const list = store.get(gid, 'statChannels', []);
      if (!list.length) {
        return interaction.reply({
          embeds: [UI.embed('통계 채널 없음', '`/통계채널 추가` 로 먼저 만들어주세요.', C.WARN)],
          flags: MessageFlags.Ephemeral,
        });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const n = await updateGuildStats(interaction.guild);
      return interaction.editReply({ content: `✅ 통계 채널 **${n}개**를 갱신했습니다.` });
    }

    // ───────── 제거 ─────────
    if (sub === '제거') {
      const list = store.get(gid, 'statChannels', []);
      let removed = 0;
      for (const s of list) {
        const ch = interaction.guild.channels.cache.get(s.id);
        if (ch) {
          await ch.delete('통계 채널 제거').catch(() => {});
          removed++;
        }
      }
      store.set(gid, 'statChannels', []);
      return interaction.reply({
        embeds: [UI.embed('🗑️ 제거 완료', `통계 채널 **${removed}개**를 삭제했습니다.`, C.SUCCESS)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  // 외부(스케줄러)에서 호출
  updateGuildStats,
  updateAllStats,
};

/** 통계 카테고리 확보 */
async function ensureCategory(guild) {
  const existingId = store.get(guild.id, 'statCategory');
  if (existingId) {
    const c = guild.channels.cache.get(existingId);
    if (c) return c;
  }
  try {
    const cat = await guild.channels.create({
      name: '📊 서버 통계',
      type: ChannelType.GuildCategory,
      position: 0,
      reason: '통계 채널 카테고리',
    });
    store.set(guild.id, 'statCategory', cat.id);
    return cat;
  } catch {
    return null;
  }
}

function safeCount(t, guild) {
  try {
    return String(t.fmt(guild));
  } catch {
    return '0';
  }
}

/**
 * 한 서버의 모든 통계 채널 이름을 갱신한다.
 * 이름 변경은 채널당 레이트리밋이 빡세므로(약 2회/10분) 간격을 둔다.
 * @returns {number} 갱신 성공 개수
 */
async function updateGuildStats(guild) {
  const list = store.get(guild.id, 'statChannels', []);
  if (!list.length) return 0;

  let count = 0;
  const stillValid = [];

  for (const s of list) {
    const ch = guild.channels.cache.get(s.id);
    if (!ch) continue; // 삭제된 채널은 목록에서 제거됨
    stillValid.push(s);

    const t = STAT_TYPES[s.type];
    if (!t) continue;

    const value = safeCount(t, guild);
    const newName = s.format.replaceAll('{수}', value).slice(0, 100);

    if (ch.name !== newName) {
      try {
        await ch.setName(newName, '통계 자동 갱신');
        count++;
        await new Promise((r) => setTimeout(r, 1200));
      } catch {
        /* 레이트리밋 등 무시 */
      }
    }
  }

  // 삭제된 채널 정리
  if (stillValid.length !== list.length) {
    store.set(guild.id, 'statChannels', stillValid);
  }
  return count;
}

/** 모든 서버의 통계 채널 갱신 (스케줄러용) */
async function updateAllStats(client) {
  let total = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      total += await updateGuildStats(guild);
    } catch {
      /* 서버별 실패 무시 */
    }
  }
  if (total > 0) console.log(`📊 통계 채널 ${total}개 갱신됨`);
  return total;
}
