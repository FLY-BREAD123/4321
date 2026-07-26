const { EmbedBuilder } = require('discord.js');
const C = require('../config');

/**
 * 메시지 템플릿의 변수를 실제 값으로 치환한다.
 *
 * 사용 가능한 변수:
 *   {유저}    - @멘션
 *   {이름}    - 유저 이름 (멘션 없이)
 *   {태그}    - 유저이름#0000 (또는 @username)
 *   {서버}    - 서버 이름
 *   {인원}    - 현재 서버 멤버 수
 *   {순번}    - 몇 번째 멤버인지 (= 인원과 동일, 입장 시점)
 */
function fill(template, member) {
  const g = member.guild;
  const count = g.memberCount;
  return String(template)
    .replaceAll('{유저}', `<@${member.id}>`)
    .replaceAll('{이름}', member.user.username)
    .replaceAll('{태그}', member.user.discriminator && member.user.discriminator !== '0'
      ? `${member.user.username}#${member.user.discriminator}`
      : `@${member.user.username}`)
    .replaceAll('{서버}', g.name)
    .replaceAll('{인원}', String(count))
    .replaceAll('{순번}', String(count))
    // 영문 별칭도 지원
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{name}', member.user.username)
    .replaceAll('{server}', g.name)
    .replaceAll('{count}', String(count))
    .replaceAll('{memberCount}', String(count));
}

/**
 * 환영/작별 설정으로 실제 전송할 페이로드를 만든다.
 * @param {object} cfg  { message, embed, color, image, thumbnail }
 * @param {GuildMember} member
 * @param {boolean} isLeave
 */
function buildPayload(cfg, member, isLeave = false) {
  const text = fill(cfg.message || (isLeave ? '{이름} 님이 나갔습니다.' : '{유저} 님 환영합니다!'), member);

  // 임베드 모드가 아니면 순수 텍스트
  if (!cfg.embed) {
    return { content: text, allowedMentions: { users: [member.id] } };
  }

  const embed = new EmbedBuilder()
    .setColor(cfg.color ?? (isLeave ? C.WARN : C.BRAND))
    .setDescription(text)
    .setTimestamp();

  const avatar = member.user.displayAvatarURL({ size: 128 });
  if (cfg.thumbnail !== false) embed.setThumbnail(avatar);

  if (isLeave) {
    embed.setAuthor({ name: `👋 ${member.guild.name}` });
  } else {
    embed.setAuthor({ name: `🎉 ${member.guild.name}` });
    embed.setFooter({ text: `${member.guild.memberCount}번째 멤버` });
  }

  if (cfg.image) embed.setImage(cfg.image);

  return {
    content: cfg.mention !== false && !isLeave ? `<@${member.id}>` : undefined,
    embeds: [embed],
    allowedMentions: { users: [member.id] },
  };
}

module.exports = { fill, buildPayload };
