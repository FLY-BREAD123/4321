const gaming = require('./gaming');
const fivem = require('./fivem');
const minecraft = require('./minecraft');
const community = require('./community');
const study = require('./study');

const PRESETS = { gaming, fivem, minecraft, community, study };

/** 프리셋 통계 (카테고리 / 텍스트 / 음성 / 역할 개수) */
function stats(preset) {
  let text = 0;
  let voice = 0;
  for (const cat of preset.categories) {
    for (const ch of cat.channels) {
      if (ch.type === 'voice' || ch.type === 'stage') voice++;
      else text++;
    }
  }
  return {
    categories: preset.categories.length,
    text,
    voice,
    roles: preset.roles.length,
    total: preset.categories.length + text + voice + preset.roles.length,
  };
}

/** 슬래시 커맨드 선택지용 */
function choices() {
  return Object.values(PRESETS).map((p) => ({
    name: `${p.emoji} ${p.name}`,
    value: p.id,
  }));
}

module.exports = { PRESETS, stats, choices };
