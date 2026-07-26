const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const C = require('../config');
const { stats } = require('../presets');
const { PALETTES, pickColors } = require('../palettes');

/** 기본 브랜드 임베드 */
function embed(title, desc, color = C.BRAND) {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(title);
  if (desc) e.setDescription(desc);
  return e;
}

/** 진행률 바 */
function bar(current, total, size = 16) {
  const ratio = total === 0 ? 1 : Math.min(1, current / total);
  const filled = Math.round(ratio * size);
  return `\`${'█'.repeat(filled)}${'░'.repeat(size - filled)}\` **${Math.round(ratio * 100)}%**`;
}

/** 프리셋 구조 미리보기 임베드 */
function presetEmbed(preset, paletteId) {
  const s = stats(preset);
  const pal = PALETTES[paletteId || preset.palette] || PALETTES.violet;
  const colors = pickColors(paletteId || preset.palette, preset.roles.length);

  const e = embed(
    `${preset.emoji} ${preset.name}`,
    `${preset.desc}\n\n` +
      `📁 카테고리 **${s.categories}** · 💬 텍스트 **${s.text}** · ` +
      `🔊 음성 **${s.voice}** · 🎭 역할 **${s.roles}**\n` +
      `🎨 색상 팔레트 · ${pal.emoji} **${pal.name}**`,
  );

  const roleLines = preset.roles
    .map((r, i) => `\`${colors[i]}\` ${r.prefix} ${r.name}`)
    .join('\n');
  e.addFields({ name: '🎭 생성될 역할 (위 -> 아래)', value: roleLines.slice(0, 1024) });

  for (const cat of preset.categories) {
    const list = cat.channels
      .map((ch) => {
        const icon =
          ch.type === 'voice' || ch.type === 'stage'
            ? '🔊'
            : ch.type === 'announcement'
              ? '📣'
              : ch.type === 'forum'
                ? '🗂️'
                : '#';
        const tags = [];
        if (ch.readOnly) tags.push('읽기전용');
        if (ch.limit) tags.push(`${ch.limit}명`);
        if (ch.slowmode) tags.push(`슬로우 ${ch.slowmode}s`);
        const name = ch.name.replace(/^🔊\s*/, '');
        return `${icon} ${name}${tags.length ? ` \`${tags.join(' · ')}\`` : ''}`;
      })
      .join('\n');
    e.addFields({
      name: `${cat.name}${cat.private ? ' 🔒' : ''}`,
      value: list.slice(0, 1024),
      inline: true,
    });
  }

  return e;
}

/** 확인 / 취소 버튼 */
function confirmRow(id = 'setup') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${id}:yes`)
      .setLabel('세팅 시작')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${id}:no`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary),
  );
}

/** 위험 작업용 2차 확인 버튼 */
function dangerRow(id = 'wipe') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${id}:yes`)
      .setLabel('전부 삭제하고 진행')
      .setEmoji('🔥')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${id}:no`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary),
  );
}

/** 최종 결과 임베드 */
function resultEmbed(report, elapsedMs) {
  const ok = report.failed.length === 0;
  const e = embed(
    ok ? '✅ 서버 세팅 완료' : '⚠️ 세팅 완료 (일부 실패)',
    `소요 시간 **${(elapsedMs / 1000).toFixed(1)}초**`,
    ok ? C.SUCCESS : C.WARN,
  );

  e.addFields(
    {
      name: '📦 생성 결과',
      value:
        `🎭 역할 **${report.roles.length}개**\n` +
        `📁 카테고리 **${report.categories.length}개**\n` +
        `💬 텍스트 **${report.text.length}개**\n` +
        `🔊 음성 **${report.voice.length}개**`,
      inline: true,
    },
    {
      name: '🗑️ 정리',
      value:
        report.deleted > 0
          ? `기존 채널 **${report.deleted}개** 삭제됨`
          : '삭제 없음',
      inline: true,
    },
  );

  if (report.skipped.length) {
    e.addFields({
      name: '⏭️ 건너뜀 (이미 존재)',
      value: report.skipped.slice(0, 15).join(', ').slice(0, 1024),
    });
  }

  if (report.failed.length) {
    const lines = report.failed
      .slice(0, 10)
      .map((f) => `• \`${f.name}\` — ${f.reason}`)
      .join('\n');
    e.addFields({ name: '❌ 실패 항목', value: lines.slice(0, 1024) });
  }

  e.setFooter({ text: '역할 색상과 권한이 자동 적용되었습니다' });
  return e;
}

module.exports = { embed, bar, presetEmbed, confirmRow, dangerRow, resultEmbed };
