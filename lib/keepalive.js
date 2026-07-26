/**
 * Render 무료 웹 서비스는 15분간 인바운드 요청이 없으면 스핀다운된다.
 * 스핀다운되면 봇도 같이 죽는다.
 *
 * 그래서 자기 자신의 공개 URL로 주기적으로 요청을 보내 살아있게 만든다.
 * Render 가 자동으로 넣어주는 RENDER_EXTERNAL_URL 을 사용한다.
 *
 * ⚠️ 이것만으로는 100% 보장되지 않는다. 한 번이라도 스핀다운되면
 *    자기 자신은 자기를 못 깨우기 때문이다.
 *    cron-job.org 같은 외부 모니터를 같이 걸어두는 게 확실하다.
 */

const DEFAULT_INTERVAL = 10 * 60 * 1000; // 10분 (스핀다운 기준 15분)

function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;

  if (!url) {
    console.log('💤 슬립 방지 꺼짐 (RENDER_EXTERNAL_URL 없음 — 로컬 실행으로 보임)');
    return null;
  }

  const interval = Number(process.env.KEEPALIVE_INTERVAL_MS) || DEFAULT_INTERVAL;
  const target = `${url.replace(/\/$/, '')}/ping`;

  const every =
    interval >= 60000 ? `${Math.round(interval / 60000)}분` : `${Math.round(interval / 1000)}초`;
  console.log(`💓 슬립 방지 켜짐 · ${every}마다 ${target}`);

  const timer = setInterval(async () => {
    try {
      const res = await fetch(target, {
        headers: { 'user-agent': 'setup-bot-keepalive' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) console.warn(`💓 응답 이상: ${res.status}`);
    } catch (err) {
      console.warn('💓 실패:', err.message);
    }
  }, interval);

  timer.unref?.();
  return timer;
}

module.exports = { startKeepAlive };
