const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const C = require('../config');
const UI = require('../lib/ui');

// 명령 실행 시점의 옵션을 잠깐 들고 있다가 모달 제출 때 꺼내 쓴다.
// (모달에는 채널/색상/멘션 같은 부가 옵션을 담을 칸이 부족하기 때문)
const pending = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('공지')
    .setDescription('임베드 형태의 공지를 작성해 채널에 보냅니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName('채널')
        .setDescription('공지를 보낼 채널')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('색상').setDescription('임베드 색상 (예: #b478ff)').setRequired(false),
    )
    .addMentionableOption((o) =>
      o.setName('멘션').setDescription('공지와 함께 멘션할 역할/유저 (예: @everyone)').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('이미지').setDescription('본문 아래 큰 이미지 URL').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('썸네일').setDescription('우측 상단 작은 이미지 URL').setRequired(false),
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('채널');

    // 봇 권한 확인
    const perms = channel.permissionsFor(interaction.guild.members.me);
    if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.EmbedLinks)) {
      return interaction.reply({
        embeds: [
          UI.embed(
            '❌ 권한 부족',
            `${channel} 에 **메시지 보내기** + **링크 첨부** 권한이 필요합니다.`,
            C.DANGER,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const colorRaw = interaction.options.getString('색상');
    let color = C.BRAND;
    if (colorRaw) {
      const c = parseColor(colorRaw);
      if (c === null) {
        return interaction.reply({
          embeds: [UI.embed('❌ 색상 오류', '`#b478ff` 같은 형식으로 입력해주세요.', C.DANGER)],
          flags: MessageFlags.Ephemeral,
        });
      }
      color = c;
    }

    const mention = interaction.options.getMentionable('멘션');
    const image = interaction.options.getString('이미지');
    const thumbnail = interaction.options.getString('썸네일');

    // 옵션 임시 저장 (유저별)
    pending.set(interaction.user.id, {
      channelId: channel.id,
      color,
      mentionId: mention?.id ?? null,
      mentionEveryone: mention?.id === interaction.guild.id, // @everyone
      image: image || null,
      thumbnail: thumbnail || null,
    });

    // 모달 띄우기
    const modal = new ModalBuilder()
      .setCustomId('notice:modal')
      .setTitle('📢 공지 작성');

    const title = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('제목')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256)
      .setPlaceholder('공지 제목')
      .setRequired(true);

    const body = new TextInputBuilder()
      .setCustomId('body')
      .setLabel('내용')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(4000)
      .setPlaceholder('공지 내용을 입력하세요. 줄바꿈 가능합니다.')
      .setRequired(true);

    const footer = new TextInputBuilder()
      .setCustomId('footer')
      .setLabel('푸터 (선택)')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048)
      .setPlaceholder('예: 갤럭시 서버 운영팀')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(body),
      new ActionRowBuilder().addComponents(footer),
    );

    await interaction.showModal(modal);
  },

  // index.js 에서 모달 제출을 이리로 넘겨준다
  async handleModal(interaction) {
    const opts = pending.get(interaction.user.id);
    pending.delete(interaction.user.id);

    if (!opts) {
      return interaction.reply({
        embeds: [UI.embed('⚠️ 만료됨', '시간이 지나 정보가 사라졌습니다. `/공지` 를 다시 실행해주세요.', C.WARN)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const title = interaction.fields.getTextInputValue('title');
    const body = interaction.fields.getTextInputValue('body');
    const footer = interaction.fields.getTextInputValue('footer');

    const channel = interaction.guild.channels.cache.get(opts.channelId);
    if (!channel) {
      return interaction.reply({
        embeds: [UI.embed('❌ 채널 없음', '보낼 채널을 찾을 수 없습니다. 삭제되었을 수 있어요.', C.DANGER)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(opts.color)
      .setTitle(title)
      .setDescription(body)
      .setTimestamp();

    if (footer) embed.setFooter({ text: footer });
    if (opts.image) embed.setImage(opts.image);
    if (opts.thumbnail) embed.setThumbnail(opts.thumbnail);

    // 멘션 구성
    let content;
    const allowed = { parse: [] };
    if (opts.mentionEveryone) {
      content = '@everyone';
      allowed.parse = ['everyone'];
    } else if (opts.mentionId) {
      // 역할인지 유저인지 판별
      const role = interaction.guild.roles.cache.get(opts.mentionId);
      if (role) {
        content = `<@&${opts.mentionId}>`;
        allowed.roles = [opts.mentionId];
      } else {
        content = `<@${opts.mentionId}>`;
        allowed.users = [opts.mentionId];
      }
    }

    try {
      await channel.send({ content, embeds: [embed], allowedMentions: allowed });
    } catch (err) {
      return interaction.reply({
        embeds: [UI.embed('❌ 전송 실패', `공지를 보내지 못했습니다.\n\`${err.message}\``, C.DANGER)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // 발행자에게만 확인 (미리보기 겸용)
    await interaction.reply({
      content: `✅ ${channel} 에 공지를 보냈습니다.`,
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

function parseColor(raw) {
  const m = String(raw).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return parseInt(m, 16);
}
