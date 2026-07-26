const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const C = require('../config');
const { PRESETS, choices, stats } = require('../presets');
const { PALETTES } = require('../palettes');
const UI = require('../lib/ui');
const { build } = require('../lib/builder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('서버세팅')
    .setDescription('카테고리 · 채널 · 역할 · 색상 · 권한을 한 번에 자동 생성합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('프리셋')
        .setDescription('어떤 종류의 서버인가요?')
        .setRequired(true)
        .addChoices(...choices()),
    )
    .addStringOption((o) =>
      o
        .setName('색상')
        .setDescription('역할 색상 팔레트 (기본: 프리셋 추천 팔레트)')
        .setRequired(false)
        .addChoices(
          ...Object.entries(PALETTES).map(([id, p]) => ({
            name: `${p.emoji} ${p.name}`,
            value: id,
          })),
        ),
    )
    .addBooleanOption((o) =>
      o
        .setName('기존삭제')
        .setDescription('기존 채널을 전부 삭제하고 새로 만듭니다 (되돌릴 수 없음)')
        .setRequired(false),
    ),

  async execute(interaction) {
    const presetId = interaction.options.getString('프리셋');
    const paletteId = interaction.options.getString('색상');
    const wipe = interaction.options.getBoolean('기존삭제') ?? false;

    const preset = PRESETS[presetId];
    if (!preset) {
      return interaction.reply({
        embeds: [UI.embed('❌ 오류', '존재하지 않는 프리셋입니다.', C.DANGER)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // 봇 권한 확인
    const me = interaction.guild.members.me;
    const missing = [];
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) missing.push('채널 관리');
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) missing.push('역할 관리');
    if (missing.length) {
      return interaction.reply({
        embeds: [
          UI.embed(
            '❌ 봇 권한 부족',
            `다음 권한이 필요합니다:\n> ${missing.join(', ')}\n\n` +
              '서버 설정 → 역할 에서 봇 역할에 권한을 주고, ' +
              '봇 역할을 **가능한 맨 위로** 올려주세요.',
            C.DANGER,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // 미리보기 + 확인 버튼
    const s = stats(preset);
    const preview = UI.presetEmbed(preset, paletteId);
    const warn = wipe
      ? '\n\n🔥 **기존 채널이 전부 삭제됩니다. 되돌릴 수 없습니다.**'
      : '\n\n💡 같은 이름이 이미 있으면 건너뜁니다.';

    const confirmEmbed = UI.embed(
      '⚡ 세팅 준비 완료',
      `**${preset.emoji} ${preset.name}** 구성으로 총 **${s.total}개** 항목을 생성합니다.` +
        `\n예상 소요 시간 약 **${Math.ceil((s.total * C.CREATE_DELAY) / 1000)}초**` +
        warn,
      wipe ? C.DANGER : C.BRAND,
    );

    await interaction.reply({
      embeds: [preview, confirmEmbed],
      components: [wipe ? UI.dangerRow('setup') : UI.confirmRow('setup')],
    });

    // 버튼 대기
    const msg = await interaction.fetchReply();
    let btn;
    try {
      btn = await msg.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('setup:'),
        time: C.CONFIRM_TIMEOUT,
      });
    } catch {
      return interaction.editReply({
        embeds: [UI.embed('⏱️ 시간 초과', '확인 시간이 지나 취소되었습니다.', C.WARN)],
        components: [],
      });
    }

    if (btn.customId === 'setup:no') {
      return btn.update({
        embeds: [UI.embed('취소됨', '세팅을 취소했습니다.', C.WARN)],
        components: [],
      });
    }

    await btn.update({
      embeds: [UI.embed('🛠️ 세팅 진행 중...', UI.bar(0, s.total), C.BRAND_SUB)],
      components: [],
    });

    // 실제 빌드
    const started = Date.now();
    let lastEdit = 0;

    const report = await build(interaction.guild, preset, {
      paletteId: paletteId || preset.palette,
      wipe,
      skipExisting: !wipe,
      onProgress: async (done, total, label) => {
        const now = Date.now();
        if (now - lastEdit < 1500) return; // 편집 레이트리밋 보호
        lastEdit = now;
        try {
          await interaction.editReply({
            embeds: [
              UI.embed(
                '🛠️ 세팅 진행 중...',
                `${UI.bar(done, total)}\n\n\`${done}/${total}\` · 생성 중: **${label ?? '-'}**`,
                C.BRAND_SUB,
              ),
            ],
            components: [],
          });
        } catch {
          /* 무시 */
        }
      },
    });

    const elapsed = Date.now() - started;
    await interaction.editReply({
      embeds: [UI.resultEmbed(report, elapsed)],
      components: [],
    });
  },
};
