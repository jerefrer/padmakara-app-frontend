/**
 * Playwright globalTeardown — stops the shared e2e infrastructure.
 *
 * Reads the infra runner PID written by global-setup.ts and sends it SIGTERM,
 * which triggers a clean MinIO shutdown inside the runner. If the runner does
 * not exit promptly it is SIGKILLed as a fallback.
 */

import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { INFRA_PID_FILE } from './global-setup';

async function globalTeardown(): Promise<void> {
  if (!existsSync(INFRA_PID_FILE)) {
    console.log('[pw global-teardown] No infra PID file — nothing to stop.');
    return;
  }

  const pid = Number(readFileSync(INFRA_PID_FILE, 'utf8').trim());
  if (!Number.isInteger(pid) || pid <= 0) {
    console.log('[pw global-teardown] Invalid infra PID — skipping.');
    return;
  }

  console.log(`[pw global-teardown] Stopping infra runner (pid ${pid})…`);
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
    cleanup();
    return;
  }

  // Give the runner up to 8s to shut MinIO down cleanly, then SIGKILL.
  for (let i = 0; i < 32; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      process.kill(pid, 0); // probe — throws if the process is gone
    } catch {
      console.log('[pw global-teardown] Infra runner stopped cleanly.');
      cleanup();
      return;
    }
  }

  console.log('[pw global-teardown] Infra runner still alive — SIGKILL.');
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // ignore
  }
  cleanup();
}

function cleanup(): void {
  try {
    unlinkSync(INFRA_PID_FILE);
  } catch {
    // ignore
  }
}

export default globalTeardown;
