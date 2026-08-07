/* ============================================================
   SIGNAL SECURITY BUREAU - INTRANET SERVER
   FiveM RP intranet: attendance, RP reports, ranks, notices
   Persistence: JSON file (data/data.json) - no external DB
   Optional: DISCORD_WEBHOOK_URL env for Discord notifications
   ============================================================ */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';

/* ---------------- rank definitions ---------------- */
const RANKS = [
  { name: '국장',     code: 'GRADE-01', desc: '보안국 전체 총괄 지휘 및 최종 승인' },
  { name: '부국장',   code: 'GRADE-02', desc: '국장 보좌, 작전 승인 및 감찰' },
  { name: '과장',     code: 'GRADE-03', desc: '부서 운영, 인사 및 교육 관리' },
  { name: '팀장',     code: 'GRADE-04', desc: '현장 팀 지휘 및 무전 통제' },
  { name: '선임요원', code: 'GRADE-05', desc: '작전 선임, 신입 요원 교육 담당' },
  { name: '요원',     code: 'GRADE-06', desc: '현장 대응, 순찰 및 보고서 작성' },
  { name: '수습요원', code: 'GRADE-07', desc: '교육 이수 중, 선임 동행 필수' }
];
const RANK_NAMES = RANKS.map(r => r.name);
const ADMIN_RANKS = ['국장', '부국장'];

const REPORT_TYPES = ['편의점', '보석상', '은행', '인질극', '추격전', '기타'];
const REPORT_RESULTS = ['전원 검거', '일부 검거', '도주', '협상 타결', '기타'];

/* ---------------- storage ---------------- */
let db = { members: [], dutyLogs: [], reports: [], notices: [] };

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      db = Object.assign(db, raw);
    }
  } catch (e) { console.error('[DATA] load failed:', e.message); }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 150);
}
function flush() {
  try {
    clearTimeout(saveTimer);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db));
  } catch (e) { console.error('[DATA] save failed:', e.message); }
}
load();
process.on('SIGINT', () => { flush(); process.exit(0); });
process.on('SIGTERM', () => { flush(); process.exit(0); });

/* ---------------- helpers ---------------- */
const uid = p => p + '_' + crypto.randomBytes(6).toString('hex');
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

function pub(m) {
  return {
    id: m.id, name: m.name, callsign: m.callsign, rank: m.rank,
    isAdmin: !!m.isAdmin, onDuty: !!m.onDuty, dutyStart: m.dutyStart || null,
    totalMs: m.totalMs || 0, joinedAt: m.joinedAt
  };
}
const findMember = id => db.members.find(m => m.id === id);
function memberName(id) {
  const m = findMember(id);
  return m ? (m.name + ' (' + m.callsign + ')') : '퇴직 요원';
}
function fmtDur(ms) {
  const h = Math.floor(ms / 3600000), mm = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? (h + '시간 ' + mm + '분') : (mm + '분');
}

function hook(title, description, fields) {
  if (!WEBHOOK) return;
  fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title, description, fields: fields || [], color: 0xf2f2f2,
        footer: { text: 'SIGNAL SECURITY BUREAU' },
        timestamp: new Date().toISOString()
      }]
    })
  }).catch(() => {});
}

/* ---------------- middleware ---------------- */
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const t = req.headers['x-auth-token'];
  const m = t && db.members.find(x => x.token && x.token === t);
  if (!m) return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
  req.member = m;
  next();
}
function adminOnly(req, res, next) {
  if (!req.member.isAdmin) return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  next();
}

/* ================= AUTH ================= */
app.post('/api/register', (req, res) => {
  const name = clean(req.body.name, 20);
  const callsign = clean(req.body.callsign, 16).toUpperCase();
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: '이름은 2자 이상 입력해 주세요.' });
  if (callsign.length < 2) return res.status(400).json({ error: '콜사인은 2자 이상 입력해 주세요.' });
  if (password.length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상 입력해 주세요.' });
  if (db.members.some(m => m.name === name)) return res.status(400).json({ error: '이미 등록된 이름입니다.' });
  if (db.members.some(m => m.callsign === callsign)) return res.status(400).json({ error: '이미 사용 중인 콜사인입니다.' });

  const salt = crypto.randomBytes(12).toString('hex');
  const first = db.members.length === 0;
  const m = {
    id: uid('m'), name, callsign, salt, passHash: hashPw(password, salt),
    rank: first ? '국장' : '수습요원', isAdmin: first,
    onDuty: false, dutyStart: null, totalMs: 0,
    token: crypto.randomBytes(24).toString('hex'), joinedAt: Date.now()
  };
  db.members.push(m); save();
  hook('신규 요원 등록', '**' + m.name + '** (' + m.callsign + ') 요원이 등록되었습니다.',
    [{ name: '직급', value: m.rank, inline: true }]);
  res.json({ token: m.token, me: pub(m) });
});

app.post('/api/login', (req, res) => {
  const name = clean(req.body.name, 20);
  const password = String(req.body.password || '');
  const m = db.members.find(x => x.name === name);
  if (!m || hashPw(password, m.salt) !== m.passHash) {
    return res.status(400).json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' });
  }
  m.token = crypto.randomBytes(24).toString('hex'); save();
  res.json({ token: m.token, me: pub(m) });
});

app.post('/api/logout', auth, (req, res) => {
  req.member.token = null; save();
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ me: pub(req.member) }));

/* ================= OVERVIEW ================= */
app.get('/api/overview', auth, (req, res) => {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const myLogs = db.dutyLogs.filter(l => l.memberId === req.member.id);
  const weekMs = myLogs.filter(l => l.end >= weekAgo).reduce((s, l) => s + l.ms, 0);
  const liveMs = req.member.onDuty ? (Date.now() - req.member.dutyStart) : 0;
  res.json({
    me: pub(req.member),
    members: db.members.map(pub).sort((a, b) =>
      RANK_NAMES.indexOf(a.rank) - RANK_NAMES.indexOf(b.rank) || a.name.localeCompare(b.name, 'ko')),
    notices: db.notices.slice(-20).reverse().map(n => ({ ...n, author: memberName(n.authorId) })),
    stats: {
      total: db.members.length,
      onDuty: db.members.filter(m => m.onDuty).length,
      reports: db.reports.length,
      myTotalMs: (req.member.totalMs || 0) + liveMs,
      myWeekMs: weekMs + liveMs,
      mySessions: myLogs.length
    }
  });
});

/* ================= DUTY ================= */
app.post('/api/duty/start', auth, (req, res) => {
  const m = req.member;
  if (m.onDuty) return res.status(400).json({ error: '이미 출근 상태입니다.' });
  m.onDuty = true; m.dutyStart = Date.now(); save();
  hook('출근', '**' + m.name + '** (' + m.callsign + ') 요원이 출근했습니다.');
  res.json({ me: pub(m) });
});

app.post('/api/duty/end', auth, (req, res) => {
  const m = req.member;
  if (!m.onDuty) return res.status(400).json({ error: '출근 상태가 아닙니다.' });
  const ms = Date.now() - m.dutyStart;
  db.dutyLogs.push({ id: uid('d'), memberId: m.id, start: m.dutyStart, end: Date.now(), ms });
  if (db.dutyLogs.length > 2000) db.dutyLogs = db.dutyLogs.slice(-2000);
  m.totalMs = (m.totalMs || 0) + ms;
  m.onDuty = false; m.dutyStart = null; save();
  hook('퇴근', '**' + m.name + '** (' + m.callsign + ') 요원이 퇴근했습니다.',
    [{ name: '근무 시간', value: fmtDur(ms), inline: true }]);
  res.json({ me: pub(m), ms });
});

app.get('/api/duty/logs', auth, (req, res) => {
  const mine = req.query.mine === '1';
  let logs = mine ? db.dutyLogs.filter(l => l.memberId === req.member.id) : db.dutyLogs;
  logs = logs.slice(-120).reverse().map(l => ({ ...l, member: memberName(l.memberId) }));
  res.json({ logs });
});

/* ================= REPORTS ================= */
app.get('/api/reports', auth, (req, res) => {
  res.json({
    reports: db.reports.slice(-150).reverse().map(r => ({
      ...r, author: memberName(r.authorId), mine: r.authorId === req.member.id
    }))
  });
});

app.post('/api/reports', auth, (req, res) => {
  const type = REPORT_TYPES.includes(req.body.type) ? req.body.type : '기타';
  const result = REPORT_RESULTS.includes(req.body.result) ? req.body.result : '기타';
  const title = clean(req.body.title, 60);
  const location = clean(req.body.location, 60);
  const agents = clean(req.body.agents, 120);
  const content = clean(req.body.content, 3000);
  if (!title) return res.status(400).json({ error: '제목을 입력해 주세요.' });
  if (!content) return res.status(400).json({ error: '상세 내용을 입력해 주세요.' });

  const r = {
    id: uid('r'), authorId: req.member.id,
    type, result, title, location, agents, content, createdAt: Date.now()
  };
  db.reports.push(r);
  if (db.reports.length > 1000) db.reports = db.reports.slice(-1000);
  save();
  const fields = [
    { name: '작성자', value: req.member.name + ' (' + req.member.callsign + ')', inline: true },
    { name: '결과', value: result, inline: true }
  ];
  if (location) fields.push({ name: '장소', value: location, inline: true });
  hook('RP 보고서 — ' + type, '**' + title + '**\n' + content.slice(0, 300), fields);
  res.json({ report: r });
});

app.delete('/api/reports/:id', auth, (req, res) => {
  const i = db.reports.findIndex(r => r.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
  if (db.reports[i].authorId !== req.member.id && !req.member.isAdmin) {
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  }
  db.reports.splice(i, 1); save();
  res.json({ ok: true });
});

/* ================= RANKS ================= */
app.get('/api/ranks', auth, (req, res) => {
  res.json({
    ranks: RANKS.map(r => ({
      ...r,
      members: db.members.filter(m => m.rank === r.name).map(pub)
    }))
  });
});

/* ================= NOTICES (admin) ================= */
app.post('/api/notices', auth, adminOnly, (req, res) => {
  const content = clean(req.body.content, 500);
  if (!content) return res.status(400).json({ error: '내용을 입력해 주세요.' });
  db.notices.push({ id: uid('n'), authorId: req.member.id, content, createdAt: Date.now() });
  if (db.notices.length > 100) db.notices = db.notices.slice(-100);
  save();
  hook('공지사항', content);
  res.json({ ok: true });
});

app.delete('/api/notices/:id', auth, adminOnly, (req, res) => {
  db.notices = db.notices.filter(n => n.id !== req.params.id); save();
  res.json({ ok: true });
});

/* ================= ADMIN ================= */
app.post('/api/admin/rank', auth, adminOnly, (req, res) => {
  const m = findMember(String(req.body.memberId || ''));
  if (!m) return res.status(404).json({ error: '요원을 찾을 수 없습니다.' });
  if (m.id === req.member.id) return res.status(400).json({ error: '본인의 직급은 변경할 수 없습니다.' });
  const rank = String(req.body.rank || '');
  if (!RANK_NAMES.includes(rank)) return res.status(400).json({ error: '올바르지 않은 직급입니다.' });
  m.rank = rank;
  m.isAdmin = ADMIN_RANKS.includes(rank);
  save();
  hook('인사 발령', '**' + m.name + '** (' + m.callsign + ') 요원 → **' + m.rank + '**');
  res.json({ ok: true });
});

app.delete('/api/admin/member/:id', auth, adminOnly, (req, res) => {
  const m = findMember(req.params.id);
  if (!m) return res.status(404).json({ error: '요원을 찾을 수 없습니다.' });
  if (m.id === req.member.id) return res.status(400).json({ error: '본인은 삭제할 수 없습니다.' });
  db.members = db.members.filter(x => x.id !== m.id);
  save();
  res.json({ ok: true });
});

/* ---------------- fallback ---------------- */
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('[SIGNAL] Security Bureau Intranet running on port ' + PORT);
  console.log('[SIGNAL] Discord webhook: ' + (WEBHOOK ? 'ENABLED' : 'disabled'));
});
