const { ChannelType, PermissionFlagsBits } = require('discord.js');
const C = require('../config');
const { pickColors, toInt } = require('../palettes');

const P = PermissionFlagsBits;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 채널 타입 문자열 -> discord.js ChannelType (커뮤니티 미지원 시 폴백) */
function channelType(type, isCommunity) {
  switch (type) {
    case 'voice':
      return ChannelType.GuildVoice;
    case 'stage':
      return isCommunity ? ChannelType.GuildStageVoice : ChannelType.GuildVoice;
    case 'announcement':
      return isCommunity ? ChannelType.GuildAnnouncement : ChannelType.GuildText;
    case 'forum':
      return isCommunity ? ChannelType.GuildForum : ChannelType.GuildText;
    default:
      return ChannelType.GuildText;
  }
}

/**
 * 권한 이름 배열 -> 비트 배열.
 * 봇이 보유하지 않은 권한은 자동으로 제외한다 (Missing Permissions 에러 방지).
 */
function resolvePerms(names, botPerms) {
  const out = [];
  for (const n of names || []) {
    const flag = P[n];
    if (!flag) continue;
    if (botPerms && !botPerms.has(flag)) continue;
    out.push(flag);
  }
  return out;
}

/** 에러 메시지 정리 */
function reason(err) {
  const msg = err?.rawError?.message || err?.message || '알 수 없는 오류';
  if (err?.code === 50013) return '봇 권한 부족';
  if (err?.code === 30013) return '채널 개수 한도 초과';
  if (err?.code === 30005) return '역할 개수 한도 초과';
  return String(msg).slice(0, 80);
}

/**
 * 메인 빌드 함수
 *
 * @param {Guild} guild
 * @param {object} preset
 * @param {object} opts { paletteId, wipe, skipExisting, onProgress }
 */
async function build(guild, preset, opts = {}) {
  const {
    paletteId = preset.palette,
    wipe = false,
    skipExisting = true,
    onProgress = () => {},
  } = opts;

  const me = guild.members.me;
  const botPerms = me.permissions;
  const isCommunity = guild.features.includes('COMMUNITY');

  const report = {
    roles: [],
    categories: [],
    text: [],
    voice: [],
    skipped: [],
    failed: [],
    deleted: 0,
  };

  // 전체 작업 개수 (진행률용)
  const totalChannels = preset.categories.reduce(
    (a, c) => a + c.channels.length,
    0,
  );
  const total = preset.roles.length + preset.categories.length + totalChannels;
  let done = 0;
  const tick = async (label) => {
    done++;
    if (done % C.PROGRESS_EVERY === 0 || done === total) {
      await onProgress(done, total, label);
    }
  };

  // ─────────────────────────────────────────────
  // 0. 기존 채널 전부 삭제 (wipe 옵션)
  // ─────────────────────────────────────────────
  if (wipe) {
    const protectedIds = new Set(
      [guild.rulesChannelId, guild.publicUpdatesChannelId, guild.safetyAlertsChannelId].filter(Boolean),
    );
    const channels = [...guild.channels.cache.values()];
    for (const ch of channels) {
      if (protectedIds.has(ch.id)) continue;
      if (!ch.deletable) continue;
      try {
        await ch.delete('서버 자동 세팅 - 기존 구조 초기화');
        report.deleted++;
        await sleep(120);
      } catch {
        /* 삭제 실패는 무시 */
      }
    }
    await onProgress(0, total, '기존 채널 정리 완료');
  }

  // ─────────────────────────────────────────────
  // 1. 역할 생성 (팔레트 색상 자동 배분)
  // ─────────────────────────────────────────────
  const colors = pickColors(paletteId, preset.roles.length);
  const roleMap = new Map(); // 프리셋 역할명 -> Role 객체
  let mutedRole = null;

  // 아래쪽 역할부터 만들어야 최종 계층 순서가 프리셋 순서와 일치한다
  for (let i = preset.roles.length - 1; i >= 0; i--) {
    const def = preset.roles[i];
    const fullName = `${def.prefix} ${def.name}`;

    const existing = guild.roles.cache.find(
      (r) => r.name === fullName || r.name === def.name,
    );
    if (existing && skipExisting) {
      roleMap.set(def.name, existing);
      if (def.muted) mutedRole = existing;
      report.skipped.push(fullName);
      await tick(fullName);
      continue;
    }

    try {
      const role = await guild.roles.create({
        name: fullName,
        color: toInt(colors[i]),
        hoist: !!def.hoist,
        mentionable: !!def.mentionable,
        permissions: resolvePerms(def.perms, botPerms),
        reason: `자동 세팅 - ${preset.name}`,
      });
      roleMap.set(def.name, role);
      if (def.muted) mutedRole = role;
      report.roles.push(fullName);
      await sleep(C.CREATE_DELAY);
    } catch (err) {
      report.failed.push({ name: fullName, reason: reason(err) });
    }
    await tick(fullName);
  }

  // ─────────────────────────────────────────────
  // 2. 카테고리 + 채널 생성
  // ─────────────────────────────────────────────

  // 관리 권한을 가진 역할들 (읽기전용 채널에서도 쓸 수 있게)
  const staffRoles = preset.roles
    .filter((r) => (r.perms || []).some((p) => ['Administrator', 'ManageGuild', 'ManageChannels', 'ManageMessages'].includes(p)))
    .map((r) => roleMap.get(r.name))
    .filter(Boolean);

  for (const cat of preset.categories) {
    let parent = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === cat.name,
    );

    if (parent && skipExisting) {
      report.skipped.push(cat.name);
      await tick(cat.name);
    } else {
      // 카테고리 권한 오버라이트 구성
      const overwrites = [];

      if (cat.private) {
        overwrites.push({
          id: guild.roles.everyone.id,
          deny: [P.ViewChannel],
        });
        for (const rn of cat.allow || []) {
          const role = roleMap.get(rn);
          if (!role) continue;
          overwrites.push({
            id: role.id,
            allow: [P.ViewChannel, P.SendMessages, P.Connect, P.Speak, P.ReadMessageHistory],
          });
        }
        // 봇 자신도 접근 가능하게
        overwrites.push({ id: me.id, allow: [P.ViewChannel, P.SendMessages, P.Connect] });
      }

      if (mutedRole) {
        overwrites.push({
          id: mutedRole.id,
          deny: [
            P.SendMessages,
            P.AddReactions,
            P.Speak,
            P.SendMessagesInThreads,
            P.CreatePublicThreads,
            P.CreatePrivateThreads,
          ],
        });
      }

      try {
        parent = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites,
          reason: `자동 세팅 - ${preset.name}`,
        });
        report.categories.push(cat.name);
        await sleep(C.CREATE_DELAY);
      } catch (err) {
        report.failed.push({ name: cat.name, reason: reason(err) });
        parent = null;
      }
      await tick(cat.name);
    }

    // 카테고리 하위 채널
    for (const ch of cat.channels) {
      const type = channelType(ch.type, isCommunity);
      const isVoice =
        type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice;

      const dup = guild.channels.cache.find(
        (c) => c.name.toLowerCase() === ch.name.toLowerCase() && c.parentId === parent?.id,
      );
      if (dup && skipExisting) {
        report.skipped.push(ch.name);
        await tick(ch.name);
        continue;
      }

      const overwrites = [];
      if (ch.readOnly && !isVoice) {
        overwrites.push({
          id: guild.roles.everyone.id,
          deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads],
          allow: [P.ReadMessageHistory],
        });
        for (const role of staffRoles) {
          overwrites.push({ id: role.id, allow: [P.SendMessages] });
        }
        overwrites.push({ id: me.id, allow: [P.SendMessages] });
      }

      const payload = {
        name: ch.name,
        type,
        reason: `자동 세팅 - ${preset.name}`,
      };
      if (parent) payload.parent = parent.id;
      if (overwrites.length) payload.permissionOverwrites = overwrites;
      if (ch.topic && !isVoice) payload.topic = ch.topic;
      if (ch.slowmode && !isVoice) payload.rateLimitPerUser = ch.slowmode;
      if (ch.limit && isVoice) payload.userLimit = ch.limit;

      try {
        await guild.channels.create(payload);
        if (isVoice) report.voice.push(ch.name);
        else report.text.push(ch.name);
        await sleep(C.CREATE_DELAY);
      } catch (err) {
        report.failed.push({ name: ch.name, reason: reason(err) });
      }
      await tick(ch.name);
    }
  }

  // ─────────────────────────────────────────────
  // 3. 역할 계층 정리 (봇 역할보다 아래에서만 가능)
  // ─────────────────────────────────────────────
  try {
    const botTop = me.roles.highest.position;
    const positions = [];
    let pos = Math.max(1, botTop - 1);
    for (const def of preset.roles) {
      const role = roleMap.get(def.name);
      if (role && role.editable) {
        positions.push({ role: role.id, position: pos });
        pos = Math.max(1, pos - 1);
      }
    }
    if (positions.length) await guild.roles.setPositions(positions);
  } catch {
    /* 계층 정리는 실패해도 무시 */
  }

  return report;
}

/**
 * 기존 역할들에 팔레트 색상을 자동 재배분한다.
 * 봇이 수정 가능한 역할만 대상으로 하며, 위 -> 아래 순서대로 색을 입힌다.
 */
async function recolor(guild, paletteId, opts = {}) {
  const { includeBots = false, onProgress = () => {} } = opts;

  const targets = [...guild.roles.cache.values()]
    .filter((r) => !r.managed || includeBots)
    .filter((r) => r.id !== guild.roles.everyone.id)
    .filter((r) => r.editable)
    .sort((a, b) => b.position - a.position);

  const colors = pickColors(paletteId, targets.length);
  const changed = [];
  const failed = [];

  for (let i = 0; i < targets.length; i++) {
    try {
      await targets[i].setColor(toInt(colors[i]), '역할 색상 팔레트 자동 적용');
      changed.push({ name: targets[i].name, color: colors[i] });
      await sleep(240);
    } catch (err) {
      failed.push({ name: targets[i].name, reason: reason(err) });
    }
    if ((i + 1) % 5 === 0) await onProgress(i + 1, targets.length);
  }

  return { changed, failed, total: targets.length };
}

module.exports = { build, recolor, channelType, resolvePerms };
