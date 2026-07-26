const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const C = require('../config');
const { PALETTES, pickColors } = require('../palettes');
const UI = require('../lib/ui');
const { recolor } = require('../lib/builder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('색상팔레트')
    .setDescription('서버의 기존 역할들에 어울리는 색상을 자동으로 다시 입힙니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('팔레트')
        .setDescription('적용할 색상 팔레트')
        .setRequired(true)
        .addChoices(
          ...Object.entries(PALETTES).map(([id, p]) => ({
            name: `${p.emoji} ${p.name} — ${p.desc}`.slice(0, 100),
            value: id,
          })),
        ),
    ),

  async execute(interaction) {
    const paletteId = interaction.options.getString('팔레트');
    const palette = PALETTES[paletteId];

    const targets = [...interaction.guild.roles.cache.values()]
      .filter((r) => !r.managed && r.id !== interaction.guild.roles.everyone.id && r.editable)
      .sort((a, b) => b.position - a.position);

    if (targets.length === 0) {
      return interaction.reply({
        embeds: [
          UI.embed(
            '⚠️ 대상 없음',
            '색을 바꿀 수 있는 역할이 없습니다.\n봇 역할이 다른 역할들보다 **위에** 있어야 수정할 수 있어요.',
            C.WARN,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const colors = pickColors(paletteId, targets.length);
    const previewList = targets
      .slice(0, 20)
      .map((r, i) => `\`${colors[i]}\` ${r.name}`)
      .join('\n');

    const preview = UI.embed(
      `${palette.emoji} ${palette.name}`,
      `${palette.desc}\n\n**${targets.length}개** 역할의 색상이 아래처럼 바뀝니다.\n\n${previewList}` +
        (targets.length > 20 ? `\n... 외 ${targets.length - 20}개` : ''),
    );

    await interaction.reply({
      embeds: [preview],
      components: [UI.confirmRow('palette')],
    });

    const msg = await interaction.fetchReply();
    let btn;
    try {
      btn = await msg.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('palette:'),
        time: C.CONFIRM_TIMEOUT,
      });
    } catch {
      return interaction.editReply({
        embeds: [UI.embed('⏱️ 시간 초과', '취소되었습니다.', C.WARN)],
        components: [],
      });
    }

    if (btn.customId === 'palette:no') {
      return btn.update({
        embeds: [UI.embed('취소됨', '색상 변경을 취소했습니다.', C.WARN)],
        components: [],
      });
    }

    await btn.update({
      embeds: [UI.embed('🎨 색상 적용 중...', UI.bar(0, targets.length), C.BRAND_SUB)],
      components: [],
    });

    let lastEdit = 0;
    const result = await recolor(interaction.guild, paletteId, {
      onProgress: async (done, total) => {
        const now = Date.now();
        if (now - lastEdit < 1500) return;
        lastEdit = now;
        try {
          await interaction.editReply({
            embeds: [
              UI.embed('🎨 색상 적용 중...', `${UI.bar(done, total)}\n\n\`${done}/${total}\``, C.BRAND_SUB),
            ],
          });
        } catch {
          /* 무시 */
        }
      },
    });

    const done = UI.embed(
      '✅ 색상 적용 완료',
      `**${result.changed.length}개** 역할의 색상을 ${palette.emoji} **${palette.name}** 팔레트로 맞췄습니다.`,
      C.SUCCESS,
    );
    if (result.failed.length) {
      done.addFields({
        name: '❌ 실패',
        value: result.failed
          .slice(0, 10)
          .map((f) => `• ${f.name} — ${f.reason}`)
          .join('\n')
          .slice(0, 1024),
      });
    }

    await interaction.editReply({ embeds: [done], components: [] });
  },
};
