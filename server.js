const http = require('node:http');

const BOOT = Date.now();
let pingCount = 0;
let lastPing = null;

/** 초 -> 일:시:분:초 */
function parts(ms) {
  const t = Math.floor(ms / 1000);
  return {
    d: Math.floor(t / 86400),
    h: Math.floor((t % 86400) / 3600),
    m: Math.floor((t % 3600) / 60),
    s: t % 60,
  };
}

/** ISO 시각 -> '3분 전' */
function ago(iso) {
  if (!iso) return '기록 없음';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return `${Math.floor(sec / 3600)}시간 전`;
}

function snapshot(client) {
  const ready = client?.isReady?.() ?? false;
  const mem = process.memoryUsage().rss / 1024 / 1024;
  return {
    status: ready ? 'online' : 'connecting',
    tag: ready ? client.user.tag : null,
    guilds: ready ? client.guilds.cache.size : 0,
    commands: client?.commands?.size ?? 0,
    ping: ready ? Math.max(0, Math.round(client.ws.ping)) : null,
    uptimeMs: Date.now() - BOOT,
    memoryMb: Math.round(mem),
    pings: pingCount,
    lastPing,
    lastPingAgo: ago(lastPing),
    // Render 무료 티어: 워크스페이스당 월 750 인스턴스 시간
    monthHours: monthHoursUsed(),
    quotaHours: 750,
  };
}

/** 이번 달 1일부터 지금까지의 시간 (24/7 가동 기준 소진량 추정) */
function monthHoursUsed() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const elapsed = (now - first) / 3600000;
  const running = (Date.now() - BOOT) / 3600000;
  return Math.round(Math.min(elapsed, running) * 10) / 10;
}

// ── 상태 페이지 ────────────────────────────────
function page(s) {
  const u = parts(s.uptimeMs);
  const pad = (n) => String(n).padStart(2, '0');
  const quotaPct = Math.min(100, (s.monthHours / s.quotaHours) * 100);
  const online = s.status === 'online';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${online ? '● 온라인' : '○ 연결 중'} · 세팅봇</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
  :root{
    --bg:#0f0d15; --surface:#17141f; --line:#2a2435;
    --accent:#b478ff; --live:#4ade80; --warn:#facc15;
    --text:#ece8f5; --muted:#7d7590;
    --state:${online ? 'var(--live)' : 'var(--warn)'};
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    background:var(--bg); color:var(--text); min-height:100vh;
    font-family:'Pretendard Variable',Pretendard,-apple-system,system-ui,sans-serif;
    display:flex; align-items:center; justify-content:center; padding:24px;
    -webkit-font-smoothing:antialiased;
  }
  .card{
    width:100%; max-width:420px; background:var(--surface);
    border:1px solid var(--line); border-radius:20px; padding:28px 26px 22px;
  }
  .state{
    display:flex; align-items:center; gap:9px;
    font-size:12px; font-weight:600; letter-spacing:.14em;
    color:var(--state); text-transform:uppercase; margin-bottom:26px;
  }
  .dot{
    width:8px; height:8px; border-radius:50%; background:var(--state);
    box-shadow:0 0 0 0 var(--state); animation:pulse 2.4s ease-out infinite;
  }
  @keyframes pulse{
    0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--state) 55%,transparent)}
    70%{box-shadow:0 0 0 11px transparent}
    100%{box-shadow:0 0 0 0 transparent}
  }
  .clock{
    font-family:ui-monospace,'SF Mono',Menlo,monospace;
    font-size:clamp(34px,11vw,46px); font-weight:600;
    letter-spacing:-.02em; line-height:1; font-variant-numeric:tabular-nums;
  }
  .clock .unit{color:var(--muted); font-size:.5em; font-weight:500; margin:0 .18em 0 .04em}
  .clock .sec{color:var(--accent)}
  .label{font-size:12px; color:var(--muted); margin-top:9px; letter-spacing:.02em}
  .grid{
    display:grid; grid-template-columns:repeat(3,1fr); gap:1px;
    background:var(--line); border:1px solid var(--line); border-radius:12px;
    overflow:hidden; margin:26px 0 22px;
  }
  .cell{background:var(--surface); padding:13px 10px; text-align:center}
  .cell b{
    display:block; font-size:17px; font-weight:600;
    font-variant-numeric:tabular-nums; margin-bottom:3px;
  }
  .cell span{font-size:10.5px; color:var(--muted); letter-spacing:.03em}
  .quota{margin-bottom:18px}
  .quota-top{
    display:flex; justify-content:space-between; align-items:baseline;
    font-size:11.5px; color:var(--muted); margin-bottom:8px;
  }
  .quota-top b{color:var(--text); font-weight:600; font-variant-numeric:tabular-nums}
  .track{height:3px; background:var(--line); border-radius:2px; overflow:hidden}
  .fill{
    height:100%; width:${quotaPct}%; border-radius:2px;
    background:${quotaPct > 92 ? 'var(--warn)' : 'var(--accent)'};
  }
  .foot{
    display:flex; justify-content:space-between; align-items:center;
    padding-top:16px; border-top:1px solid var(--line);
    font-size:11px; color:var(--muted);
  }
  .foot code{font-family:ui-monospace,monospace; color:var(--accent)}
  @media (prefers-reduced-motion:reduce){ .dot{animation:none} }
</style>
</head>
<body>
  <main class="card">
    <div class="state"><i class="dot"></i>${online ? '온라인' : '연결 중'}</div>

    <div class="clock" id="clock">
      ${u.d}<span class="unit">일</span>${pad(u.h)}<span class="unit">시간</span>${pad(u.m)}<span class="unit">분</span><span class="sec">${pad(u.s)}</span><span class="unit">초</span>
    </div>
    <p class="label">마지막 재시작 이후 끊김 없이 가동 중</p>

    <div class="grid">
      <div class="cell"><b>${s.guilds}</b><span>서버</span></div>
      <div class="cell"><b>${s.commands}</b><span>명령어</span></div>
      <div class="cell"><b>${s.ping ?? '—'}<small style="font-size:10px;color:var(--muted)">ms</small></b><span>응답</span></div>
    </div>

    <div class="quota">
      <div class="quota-top">
        <span>이번 가동 · 월 무료 한도 기준</span>
        <span><b>${s.monthHours}</b> / ${s.quotaHours}h</span>
      </div>
      <div class="track"><div class="fill"></div></div>
    </div>

    <div class="foot">
      <span>깨우기 <b style="color:var(--text)">${s.pings}</b>회 · ${s.lastPingAgo}</span>
      <span><code>${s.memoryMb}MB</code></span>
    </div>
  </main>

<script>
  // 서버가 준 시각부터 이어서 카운트 (새로고침 없이 계속 흐름)
  let ms = ${s.uptimeMs};
  const el = document.getElementById('clock');
  const p = n => String(n).padStart(2,'0');
  setInterval(() => {
    ms += 1000;
    const t = Math.floor(ms/1000);
    const d = Math.floor(t/86400), h = Math.floor(t%86400/3600),
          m = Math.floor(t%3600/60), sec = t%60;
    el.innerHTML = d + '<span class="unit">일</span>' + p(h) + '<span class="unit">시간</span>'
      + p(m) + '<span class="unit">분</span><span class="sec">' + p(sec) + '</span><span class="unit">초</span>';
  }, 1000);

  // 1분마다 상태 갱신 (이 요청 자체가 슬립 방지에도 도움)
  setInterval(() => fetch('/health').then(r => r.json()).then(d => {
    if (d.uptimeMs < ms) location.reload();   // 재시작 감지
  }).catch(() => {}), 60000);
</script>
</body>
</html>`;
}

/**
 * HTTP 서버 시작.
 * Render Web Service 는 PORT 로 리스닝하지 않으면 배포가 실패하므로 필수.
 */
function startServer(client) {
  const port = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];

    if (url === '/ping') {
      pingCount++;
      lastPing = new Date().toISOString();
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('pong');
    }

    if (url === '/health') {
      const s = snapshot(client);
      res.writeHead(s.status === 'online' ? 200 : 503, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      return res.end(JSON.stringify(s));
    }

    if (url === '/') {
      pingCount++;
      lastPing = new Date().toISOString();
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      return res.end(page(snapshot(client)));
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  });

  server.listen(port, () => {
    console.log(`🌐 상태 페이지: 포트 ${port}`);
  });

  return server;
}

module.exports = { startServer, snapshot };
