const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const C = require('../config');
const UI = require('../lib/ui');
const store = require('../lib/store');
const { buildPayload } = require('../lib/welcome');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('환영설정')
    .setDescription('멤버 입장/퇴장 시 자동 메시지를 설정합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    // ── 입장 ──
    .addSubcommand((s) =>
      s
        .setName('입장')
        .setDescription('멤버가 들어왔을 때 보낼 메시지를 설정')
        .addChannelOption((o) =>
          o
            .setName('채널')
            .setDescription('메시지를 보낼 채널')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('메시지')
            .setDescription('변수: {유저} {이름} {서버} {인원} — 비우면 기본 문구')
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o.setName('임베드').setDescription('임베드 카드 형태로 보낼지 (기본: 켬)').setRequired(false),
        )
        .addStringOption((o) =>
          o.setName('색상').setDescription('임베드 색상 (예: #b478ff)').setRequired(false),
        )
        .addRoleOption((o) =>
          o.setName('자동역할').setDescription('입장 시 자동으로 줄 역할').setRequired(false),
        )
        .addStringOption((o) =>
          o.setName('이미지').setDescription('임베드 하단 이미지 URL').setRequired(false),
        ),
    )
    // ── 퇴장 ──
    .addSubcommand((s) =>
      s
        .setName('퇴장')
        .setDescription('멤버가 나갔을 때 보낼 메시지를 설정')
        .addChannelOption((o) =>
          o
            .setName('채널')
            .setDescription('메시지를 보낼 채널')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('메시지')
            .setDescription('변수: {이름} {서버} {인원} — 비우면 기본 문구')
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o.setName('임베드').setDescription('임베드 카드 형태로 보낼지 (기본: 켬)').setRequired(false),
        ),
    )
    // ── 미리보기 ──
    .addSubcommand((s) =>
      s.setName('테스트').setDescription('지금 설정된 입장 메시지를 나에게 미리 보여줍니다'),
    )
    // ── 끄기 ──
    .addSubcommand((s) =>
      s
        .setName('끄기')
        .setDescription('입장 또는 퇴장 메시지를 끕니다')
        .addStringOption((o) =>
          o
            .setName('종류')
            .setDescription('무엇을 끌지')
            .setRequired(true)
            .addChoices(
              { name: '입장 메시지', value: 'welcome' },
              { name: '퇴장 메시지', value: 'leave' },
              { name: '자동 역할', value: 'autorole' },
            ),
        ),
    )
    // ── 현재 설정 보기 ──
    .addSubcommand((s) =>
      s.setName('상태').setDescription('현재 환영 설정을 확인합니다'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guild.id;

    // ───────── 입장 ─────────
    if (sub === '입장') {
      const channel = interaction.options.getChannel('채널');
      const message = interaction.options.getString('메시지');
      const embed = interaction.options.getBoolean('임베드') ?? true;
      const colorRaw = interaction.options.getString('색상');
      const autorole = interaction.options.getRole('자동역할');
      const image = interaction.options.getString('이미지');

      // 봇이 그 채널에 쓸 수 있는지
      const perms = channel.permissionsFor(interaction.guild.members.me);
      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.reply({
          embeds: [UI.embed('❌ 권한 없음', `${channel} 에 메시지를 보낼 권한이 없습니다.`, C.DANGER)],
          flags: MessageFlags.Ephemeral,
        });
      }

      const cfg = { channelId: channel.id, message: message || null, embed };
      if (colorRaw) {
        const c = parseColor(colorRaw);
        if (c === null) {
          return interaction.reply({
            embeds: [UI.embed('❌ 색상 오류', '`#b478ff` 같은 형식으로 입력해주세요.', C.DANGER)],
            flags: MessageFlags.Ephemeral,
          });
        }
        cfg.color = c;
      }
      if (image) cfg.image = image;

      store.set(gid, 'welcome', cfg);

      // 자동역할 처리
      if (autorole) {
        if (!autorole.editable) {
          return interaction.reply({
            embeds: [
              UI.embed(
                '⚠️ 역할 위치 문제',
                `**${autorole.name}** 역할을 봇이 줄 수 없습니다.\n봇 역할을 이 역할보다 **위로** 올려주세요.`,
                C.WARN,
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
        store.set(gid, 'autorole', autorole.id);
      }

      const e = UI.embed(
        '✅ 입장 메시지 설정 완료',
        `채널 ${channel}\n형식 ${embed ? '임베드 카드' : '일반 텍스트'}` +
          (autorole ? `\n자동 역할 ${autorole}` : ''),
        C.SUCCESS,
      );
      e.addFields({
        name: '미리보기',
        value: '`/환영설정 테스트` 로 실제 모습을 확인할 수 있어요.',
      });
      return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    }

    // ───────── 퇴장 ─────────
    if (sub === '퇴장') {
      const channel = interaction.options.getChannel('채널');
      const message = interaction.options.getString('메시지');
      const embed = interaction.options.getBoolean('임베드') ?? true;

      const perms = channel.permissionsFor(interaction.guild.members.me);
      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.reply({
          embeds: [UI.embed('❌ 권한 없음', `${channel} 에 메시지를 보낼 권한이 없습니다.`, C.DANGER)],
          flags: MessageFlags.Ephemeral,
        });
      }

      store.set(gid, 'leave', { channelId: channel.id, message: message || null, embed });
      return interaction.reply({
        embeds: [UI.embed('✅ 퇴장 메시지 설정 완료', `채널 ${channel}`, C.SUCCESS)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ───────── 테스트 ─────────
    if (sub === '테스트') {
      const cfg = store.get(gid, 'welcome');
      if (!cfg) {
        return interaction.reply({
          embeds: [UI.embed('설정 없음', '먼저 `/환영설정 입장` 으로 설정해주세요.', C.WARN)],
          flags: MessageFlags.Ephemeral,
        });
      }
      const payload = buildPayload(cfg, interaction.member, false);
      return interaction.reply({
        content: `**미리보기** (실제로는 <#${cfg.channelId}> 에 전송됩니다)\n\n${payload.content ?? ''}`,
        embeds: payload.embeds ?? [],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }

    // ───────── 끄기 ─────────
    if (sub === '끄기') {
      const kind = interaction.options.getString('종류');
      const label = { welcome: '입장 메시지', leave: '퇴장 메시지', autorole: '자동 역할' }[kind];
      store.del(gid, kind);
      return interaction.reply({
        embeds: [UI.embed('🔕 꺼짐', `**${label}** 을(를) 껐습니다.`, C.WARN)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ───────── 상태 ─────────
    if (sub === '상태') {
      const w = store.get(gid, 'welcome');
      const l = store.get(gid, 'leave');
      const ar = store.get(gid, 'autorole');

      const e = UI.embed('⚙️ 환영 설정 상태', null);
      e.addFields(
        {
          name: '📥 입장 메시지',
          value: w
            ? `켬 · <#${w.channelId}> · ${w.embed ? '임베드' : '텍스트'}`
            : '꺼짐',
          inline: false,
        },
        {
          name: '📤 퇴장 메시지',
          value: l ? `켬 · <#${l.channelId}> · ${l.embed ? '임베드' : '텍스트'}` : '꺼짐',
          inline: false,
        },
        {
          name: '🎭 자동 역할',
          value: ar ? `<@&${ar}>` : '꺼짐',
          inline: false,
        },
      );
      e.setFooter({ text: '사용 가능한 변수: {유저} {이름} {서버} {인원}' });
      return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    }
  },
};

/** '#rrggbb' 또는 'rrggbb' -> 정수, 실패 시 null */
function parseColor(raw) {
  const m = String(raw).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return parseInt(m, 16);
}
