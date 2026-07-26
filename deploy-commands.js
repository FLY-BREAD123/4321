require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ .env 에 DISCORD_TOKEN 과 CLIENT_ID 가 필요합니다.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`⏳ 명령어 ${commands.length}개 등록 중...`);

    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    const data = await rest.put(route, { body: commands });

    console.log(`✅ ${data.length}개 등록 완료 ${GUILD_ID ? '(길드 전용 - 즉시 반영)' : '(전역 - 최대 1시간 소요)'}`);
    for (const c of data) console.log(`   /${c.name}`);
  } catch (err) {
    console.error('❌ 등록 실패:', err);
  }
})();
