import { dispatchSensitiveAlertsBatch } from '../src/lib/sensitiveAlerts';

function getIntervalMs() {
  const value = Number(process.env.SENSITIVE_ALERT_WORKER_INTERVAL_MS || 15000);
  if (!Number.isFinite(value) || value < 1000) return 15000;
  return Math.floor(value);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoop() {
  const intervalMs = getIntervalMs();
  console.log(`[sensitive-alert-worker] started, interval=${intervalMs}ms`);

  let stopping = false;

  const stop = () => {
    stopping = true;
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    try {
      const result = await dispatchSensitiveAlertsBatch();
      if (result.scanned > 0 || result.sent > 0 || result.failed > 0) {
        console.log(
          `[sensitive-alert-worker] scanned=${result.scanned} claimed=${result.claimed} sent=${result.sent} failed=${result.failed}`,
        );
      }
    } catch (error) {
      console.error('[sensitive-alert-worker] tick error:', error);
    }

    await sleep(intervalMs);
  }

  console.log('[sensitive-alert-worker] stopped');
}

runLoop().catch((error) => {
  console.error('[sensitive-alert-worker] fatal error:', error);
  process.exit(1);
});
