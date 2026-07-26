/**
 * 봇이 켜질 때 슬래시 명령어를 자동으로 맞춰준다.
 *
 * Render 는 배포·재시작이 잦은데 매번 명령어를 다시 등록하면
 * 디스코드 등록 제한(전역 명령어 하루 200회)에 걸릴 수 있다.
 * 그래서 이미 등록된 내용을 먼저 읽어와 비교하고, 달라졌을 때만 등록한다.
 */

/**
 * 비교용으로 필요한 필드만 남긴다 (API가 돌려주는 id, version 등은 무시).
 * 로컬은 toJSON() 이라 snake_case, discord.js 가 돌려주는 쪽은 camelCase 라서
 * 양쪽 키를 모두 봐야 한다. 안 그러면 매번 "달라졌다"고 판단해 재등록된다.
 */
function normOption(o) {
  return {
    name: o.name,
    type: o.type,
    description: o.description,
    required: !!o.required,
    autocomplete: !!o.autocomplete,
    min: o.min_value ?? o.minValue ?? null,
    max: o.max_value ?? o.maxValue ?? null,
    minLen: o.min_length ?? o.minLength ?? null,
    maxLen: o.max_length ?? o.maxLength ?? null,
    channels: (o.channel_types ?? o.channelTypes ?? []).slice().sort(),
    choices: (o.choices || []).map((c) => `${c.name}\u0000${c.value}`),
    options: (o.options || []).map(normOption),
  };
}

function normCommand(c) {
  return {
    name: c.name,
    description: c.description,
    perms: c.default_member_permissions ?? null,
    options: (c.options || []).map(normOption),
  };
}

function fingerprint(list) {
  return JSON.stringify(
    [...list].map(normCommand).sort((a, b) => a.name.localeCompare(b.name)),
  );
}

/**
 * @param {Client} client 로그인 완료된 클라이언트
 * @param {boolean} force  true 면 비교 없이 무조건 등록
 */
async function syncCommands(client, force = false) {
  const local = [...client.commands.values()].map((c) => c.data.toJSON());
  const guildId = process.env.GUILD_ID;

  const manager = client.application.commands;
  const scope = guildId ? `길드(${guildId})` : '전역';

  try {
    const remote = await manager.fetch(guildId ? { guildId } : {});
    const remoteList = [...remote.values()].map((c) => ({
      name: c.name,
      description: c.description,
      default_member_permissions:
        c.defaultMemberPermissions?.bitfield?.toString() ?? null,
      options: c.options ?? [],
    }));

    if (!force && fingerprint(local) === fingerprint(remoteList)) {
      console.log(`⏭️  명령어 ${local.length}개 — 이미 최신 (${scope})`);
      return { changed: false, count: local.length };
    }

    await manager.set(local, guildId || undefined);
    console.log(`✅ 명령어 ${local.length}개 등록 완료 (${scope})`);
    return { changed: true, count: local.length };
  } catch (err) {
    console.error('❌ 명령어 등록 실패:', err?.message || err);
    return { changed: false, count: 0, error: err };
  }
}

module.exports = { syncCommands, fingerprint };
