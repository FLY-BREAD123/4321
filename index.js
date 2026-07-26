require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType,
  MessageFlags,
} = require('discord.js');
const C = require('./config');
const UI = require('./lib/ui');
const store = require('./lib/store');
const { startServer } = require('./server');
const { startKeepAlive } = require('./lib/keepalive');
const { syncCommands } = require('./lib/deploy');
const { buildPayload } = require('./lib/welcome');
const statsCmd = require('./commands/stats');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // 환영/작별 메시지, 자동역할, 통계 채널에 필요.
    // ⚠️ 이건 특권 인텐트라 개발자 포털 > Bot > "Server Members Intent" 를 켜야 함.
    GatewayIntentBits.GuildMembers,
    // 온라인 인원 통계에 필요. 안 켜면 online 통계만 부정확할 뿐 나머지는 정상.
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.GuildMember],
});

// ── 명령어 로드 ──────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[경고] ${file} 에 data 또는 execute 가 없습니다.`);
  }
}

// ── HTTP 서버 먼저 켠다 ──────────────────────
// Render Web Service 는 PORT 리스닝을 감지하지 못하면 배포를 실패로 처리한다.
// 디스코드 로그인보다 먼저 열어둬야 안전하다.
startServer(client);

// ── 준비 완료 ────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ 로그인 완료: ${c.user.tag}`);
  console.log(`📊 서버 ${c.guilds.cache.size}개 · 명령어 ${client.commands.size}개`);
  c.user.setActivity('/서버세팅', { type: ActivityType.Listening });

  // 명령어가 바뀌었을 때만 자동 등록
  if (process.env.AUTO_DEPLOY !== 'false') {
    await syncCommands(client, process.env.FORCE_DEPLOY === 'true');
  }

  // Render 슬립 방지
  startKeepAlive();

  // 통계 채널 주기 갱신 (10분마다)
  // 채널 이름 변경은 레이트리밋이 빡세서 이보다 자주 하면 안 된다.
  const runStats = () => statsCmd.updateAllStats(client).catch(() => {});
  setTimeout(runStats, 15_000); // 부팅 직후 한 번
  const statTimer = setInterval(runStats, 10 * 60 * 1000);
  statTimer.unref?.();
});

// ── 멤버 입장 ────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot && store.get(member.guild.id, 'welcome.skipBots', true)) {
    // 봇은 기본적으로 환영 안 함 (자동역할은 적용)
  }

  const gid = member.guild.id;

  // 자동 역할
  const roleId = store.get(gid, 'autorole');
  if (roleId && !member.user.bot) {
    const role = member.guild.roles.cache.get(roleId);
    if (role && role.editable) {
      member.roles.add(role, '자동 역할 지급').catch(() => {});
    }
  }

  // 환영 메시지
  const cfg = store.get(gid, 'welcome');
  if (cfg?.channelId && !member.user.bot) {
    const channel = member.guild.channels.cache.get(cfg.channelId);
    if (channel) {
      const payload = buildPayload(cfg, member, false);
      channel.send(payload).catch(() => {});
    }
  }
});

// ── 멤버 퇴장 ────────────────────────────────
client.on(Events.GuildMemberRemove, async (member) => {
  if (member.user?.bot) return;
  const cfg = store.get(member.guild.id, 'leave');
  if (cfg?.channelId) {
    const channel = member.guild.channels.cache.get(cfg.channelId);
    if (channel) {
      const payload = buildPayload(cfg, member, true);
      channel.send(payload).catch(() => {});
    }
  }
});

// ── 인터랙션 처리 ────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  // 자동완성
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error('자동완성 오류:', err);
    }
    return;
  }

  // 모달 제출 (공지 작성기)
  if (interaction.isModalSubmit()) {
    try {
      if (interaction.customId === 'notice:modal') {
        await client.commands.get('공지').handleModal(interaction);
      }
    } catch (err) {
      console.error('모달 처리 오류:', err);
      safeError(interaction);
    }
    return;
  }

  // 버튼 (티켓 시스템)
  if (interaction.isButton()) {
    try {
      if (interaction.customId.startsWith('ticket:')) {
        await client.commands.get('티켓').handleButton(interaction);
      }
      // setup/palette 등의 확인 버튼은 각 명령어가 awaitMessageComponent 로
      // 직접 수집하므로 여기서 건드리지 않는다.
    } catch (err) {
      console.error('버튼 처리 오류:', err);
      safeError(interaction);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[${interaction.commandName}] 실행 오류:`, err);
    safeError(interaction);
  }
});

/** 인터랙션 오류 시 안전하게 에러 응답 */
async function safeError(interaction) {
  const payload = {
    embeds: [
      UI.embed(
        '❌ 오류 발생',
        '처리 중 문제가 생겼습니다. 봇 권한과 역할 위치를 확인해주세요.',
        C.DANGER,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    /* 무시 */
  }
}

// ── 연결 이벤트 로그 ─────────────────────────
client.on(Events.ShardDisconnect, (_, id) => console.warn(`⚠️ 샤드 ${id} 연결 끊김`));
client.on(Events.ShardReconnecting, (id) => console.log(`🔄 샤드 ${id} 재연결 중`));
client.on(Events.ShardResume, (id) => console.log(`✅ 샤드 ${id} 재개`));
client.on(Events.Error, (err) => console.error('클라이언트 오류:', err));

process.on('unhandledRejection', (err) => console.error('처리되지 않은 오류:', err));
process.on('uncaughtException', (err) => console.error('처리되지 않은 예외:', err));

// Render 재배포 시 깔끔하게 종료
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`🛑 ${sig} 수신 — 종료합니다`);
    store.flushNow(); // 설정 저장 보장
    client.destroy();
    process.exit(0);
  });
}

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN 이 없습니다. Render > Environment 에서 설정하세요.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('❌ 로그인 실패:', err?.message || err?.code || '토큰이 거부되었습니다');
  console.error(
    '   DISCORD_TOKEN 값을 확인하세요. 개발자 포털에서 Reset Token 을 누른 적이 있으면 이전 토큰은 무효입니다.',
  );
  process.exit(1);
});
