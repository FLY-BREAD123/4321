const fs = require('node:fs');
const path = require('node:path');

/**
 * 서버별 설정을 JSON 파일 하나에 저장한다. (DB 불필요)
 *
 * ⚠️ Render 무료 티어 주의:
 *   Render 는 디스크가 영구적이지 않다(ephemeral). 재배포하거나 서비스가
 *   재시작되면 이 파일이 초기화된다. 즉 환영 메시지 채널 설정, 티켓 설정,
 *   통계 채널 ID 등이 배포 때마다 날아갈 수 있다.
 *
 *   해결책:
 *   1) Render 유료 플랜에서 Persistent Disk 를 붙이고 DATA_DIR 를 그 경로로
 *   2) 무료로 유지하려면 배포 후 설정 명령어(/환영설정 등)를 다시 실행
 *
 *   DATA_DIR 환경변수로 저장 위치를 바꿀 수 있다.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'guilds.json');

let cache = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAll() {
  if (cache) return cache;
  try {
    ensureDir();
    if (fs.existsSync(FILE)) {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } else {
      cache = {};
    }
  } catch (err) {
    console.error('⚠️ 설정 파일 읽기 실패, 새로 시작합니다:', err.message);
    cache = {};
  }
  return cache;
}

let saveTimer = null;
function flush() {
  try {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('⚠️ 설정 저장 실패:', err.message);
  }
}

/** 잦은 쓰기를 모아서 처리 */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
  saveTimer.unref?.();
}

/** 한 서버의 전체 설정 객체 (없으면 기본값) */
function getGuild(guildId) {
  const all = loadAll();
  if (!all[guildId]) all[guildId] = {};
  return all[guildId];
}

/** 특정 키 읽기 (점 표기 지원: 'welcome.channelId') */
function get(guildId, keyPath, fallback = null) {
  const g = getGuild(guildId);
  const parts = keyPath.split('.');
  let cur = g;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return fallback;
    cur = cur[p];
  }
  return cur === undefined ? fallback : cur;
}

/** 특정 키 저장 (점 표기 지원) */
function set(guildId, keyPath, value) {
  const g = getGuild(guildId);
  const parts = keyPath.split('.');
  let cur = g;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  scheduleSave();
  return value;
}

/** 특정 키 삭제 */
function del(guildId, keyPath) {
  const g = getGuild(guildId);
  const parts = keyPath.split('.');
  let cur = g;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object') return;
    cur = cur[parts[i]];
  }
  delete cur[parts[parts.length - 1]];
  scheduleSave();
}

/** 전체 서버 목록 (통계 채널 갱신 등 순회용) */
function allGuildIds() {
  return Object.keys(loadAll());
}

/** 대기 중인 저장을 즉시 강제 실행 (프로세스 종료 전 호출용) */
function flushNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (cache) flush();
}

module.exports = { get, set, del, getGuild, allGuildIds, flushNow, DATA_DIR };
