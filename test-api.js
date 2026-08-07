/* integration test for SIGNAL intranet API */
const B = 'http://127.0.0.1:3100/api';
let fails = 0;
function chk(name, cond, extra){
  if (cond) console.log('PASS', name);
  else { fails++; console.log('FAIL', name, extra || ''); }
}
async function j(p, o = {}, t){
  const res = await fetch(B + p, {
    method: o.m || 'GET',
    headers: { 'Content-Type': 'application/json', ...(t ? { 'X-Auth-Token': t } : {}) },
    body: o.b ? JSON.stringify(o.b) : undefined
  });
  const d = await res.json().catch(() => ({}));
  return { s: res.status, d };
}
(async () => {
  let r = await j('/register', { m: 'POST', b: { name: '김국장', callsign: 'sg-00', password: '1234' } });
  chk('register first -> 국장/admin', r.s === 200 && r.d.me.rank === '국장' && r.d.me.isAdmin === true, JSON.stringify(r.d));
  const tA = r.d.token;

  r = await j('/register', { m: 'POST', b: { name: '박요원', callsign: 'sg-07', password: '1234' } });
  chk('register second -> 수습요원', r.s === 200 && r.d.me.rank === '수습요원' && !r.d.me.isAdmin);
  let tB = r.d.token;

  r = await j('/register', { m: 'POST', b: { name: '박요원', callsign: 'SG-99', password: '1234' } });
  chk('dup name rejected', r.s === 400);
  r = await j('/register', { m: 'POST', b: { name: '중복콜', callsign: 'SG-07', password: '1234' } });
  chk('dup callsign rejected', r.s === 400);

  r = await j('/login', { m: 'POST', b: { name: '박요원', password: 'wrong' } });
  chk('wrong pw rejected', r.s === 400);
  r = await j('/login', { m: 'POST', b: { name: '박요원', password: '1234' } });
  chk('login ok', r.s === 200 && r.d.token);
  tB = r.d.token;

  r = await j('/me', {}, 'badtoken');
  chk('bad token -> 401', r.s === 401);

  r = await j('/duty/start', { m: 'POST' }, tB);
  chk('duty start', r.s === 200 && r.d.me.onDuty === true);
  r = await j('/duty/start', { m: 'POST' }, tB);
  chk('double start rejected', r.s === 400);
  await new Promise(x => setTimeout(x, 1100));
  r = await j('/duty/end', { m: 'POST' }, tB);
  chk('duty end with ms', r.s === 200 && r.d.ms > 0 && r.d.me.onDuty === false);

  r = await j('/reports', { m: 'POST', b: { type: '은행', result: '전원 검거', title: '퍼시픽 은행 강도 대응', location: '퍼시픽 스탠다드', agents: 'SG-07', content: '테스트 본문입니다.' } }, tB);
  chk('report create', r.s === 200 && r.d.report.type === '은행');
  const repId = r.d.report.id;
  r = await j('/reports', {}, tA);
  chk('report list + author', r.s === 200 && r.d.reports.length === 1 && r.d.reports[0].author.includes('박요원'));
  r = await j('/reports/' + repId, { m: 'DELETE' }, tA);
  chk('admin can delete report', r.s === 200);

  r = await j('/ranks', {}, tB);
  chk('ranks 7 tiers', r.s === 200 && r.d.ranks.length === 7 && r.d.ranks[0].members.length === 1);

  const ov = await j('/overview', {}, tA);
  chk('overview stats', ov.s === 200 && ov.d.stats.total === 2);
  const memberB = ov.d.members.find(m => m.callsign === 'SG-07');
  r = await j('/admin/rank', { m: 'POST', b: { memberId: memberB.id, rank: '부국장' } }, tA);
  chk('promote to 부국장', r.s === 200);
  r = await j('/me', {}, tB);
  chk('promoted member is now admin', r.s === 200 && r.d.me.rank === '부국장' && r.d.me.isAdmin === true);
  r = await j('/admin/rank', { m: 'POST', b: { memberId: memberB.id, rank: '없는직급' } }, tA);
  chk('invalid rank rejected', r.s === 400);

  r = await j('/notices', { m: 'POST', b: { content: '금일 20시 합동 훈련이 있습니다.' } }, tA);
  chk('notice create (admin)', r.s === 200);
  r = await j('/admin/rank', { m: 'POST', b: { memberId: memberB.id, rank: '요원' } }, tA);
  chk('demote back', r.s === 200);
  r = await j('/notices', { m: 'POST', b: { content: 'x' } }, tB);
  chk('notice by non-admin -> 403', r.s === 403);

  r = await j('/duty/logs?mine=1', {}, tB);
  chk('my duty logs', r.s === 200 && r.d.logs.length === 1);
  r = await j('/overview', {}, tB);
  chk('overview after changes', r.s === 200 && r.d.me.rank === '요원' && r.d.notices.length === 1);

  console.log(fails === 0 ? 'ALL_TESTS_PASSED' : ('FAILED_COUNT ' + fails));
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('TEST_CRASH', e); process.exit(1); });
