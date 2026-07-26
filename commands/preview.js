const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const C = require('../config');
const { PRESETS, choices } = require('../presets');
const { PALETTES } = require('../palettes');
const UI = require('../lib/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('미리보기')
    .setDescription('프리셋이 어떤 구조로 만들어지는지 먼저 확인합니다')
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('프리셋')
        .setDescription('확인할 프리셋')
        .setRequired(true)
        .addChoices(...choices()),
    )
    .addStringOption((o) =>
      o
        .setName('색상')
        .setDescription('적용해볼 색상 팔레트')
        .setRequired(false)
        .addChoices(
          ...Object.entries(PALETTES).map(([id, p]) => ({
            name: `${p.emoji} ${p.name}`,
            value: id,
          })),
        ),
    ),

  async execute(interaction) {
    const preset = PRESETS[interaction.options.getString('프리셋')];
    const paletteId = interaction.options.getString('색상');

    if (!preset) {
      return interaction.reply({
        embeds: [UI.embed('❌ 오류', '존재하지 않는 프리셋입니다.', C.DANGER)],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [UI.presetEmbed(preset, paletteId)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
