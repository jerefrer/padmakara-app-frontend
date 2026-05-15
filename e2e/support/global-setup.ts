/**
 * Playwright globalSetup — boots the shared e2e infrastructure.
 *
 * Spawns the `playwright-infra.ts run` runner from the padmakara-api worktree.
 * That runner:
 *   1. Resets + migrates + seeds the `padmakara_test` database.
 *   2. Starts MinIO (local S3) and creates the test bucket.
 *   3. Uploads placeholder fixture media to MinIO.
 *   4. Prints `INFRA_READY` to stdout, then idles holding MinIO alive.
 *
 * We wait for the `INFRA_READY` line, then return. The runner stays alive for
 * the whole Playwright session; `global-teardown.ts` sends it SIGTERM so it
 * shuts MinIO down cleanly.
 *
 * The runner's PID is written to a temp file so global-teardown can find it.
 *
 * SAFETY: the runner sets DATABASE_URL → padmakara_test and S3_ENDPOINT →
 * local MinIO itself and refuses to run against anything else, so this can
 * never touch the real database or AWS S3.
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Absolute path to the padmakara-api worktree (sibling of this worktree).
 * __dirname is `<…>/.worktrees/pw-app/e2e/support`, so three `..` segments
 * climb to `<…>/.worktrees`, then `pw-api` is the sibling worktree.
 */
const API_WORKTREE = join(__dirname, '..', '..', '..', 'pw-api');
const INFRA_SCRIPT = join(
  API_WORKTREE,
  'tests',
  'e2e',
  'support',
  'playwright-infra.ts',
);

/** Temp file holding the infra runner PID, read by global-teardown. */
export const INFRA_PID_FILE = join(tmpdir(), 'padmakara-pw-infra.pid');

/** Absolute path to the Bun binary. Override via BUN_BIN if not on PATH. */
const BUN_BIN = process.env.BUN_BIN ?? `${process.env.HOME}/.bun/bin/bun`;

async function globalSetup(): Promise<void> {
  console.log('[pw global-setup] Starting e2e infrastructure runner…');

  const child = spawn(BUN_BIN, [INFRA_SCRIPT, 'run'], {
    cwd: API_WORKTREE,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Detach so the runner survives as its own process group; teardown kills
    // it explicitly by PID.
    detached: false,
  });

  if (child.pid === undefined) {
    throw new Error('[pw global-setup] Failed to spawn infra runner.');
  }
  writeFileSync(INFRA_PID_FILE, String(child.pid), 'utf8');

  // Forward runner output so infrastructure problems are visible in the
  // Playwright run log.
  let buffered = '';
  const onData = (chunk: Buffer): void => {
    const text = chunk.toString();
    buffered += text;
    for (const line of text.split('\n')) {
      if (line.trim()) console.log(`[infra] ${line.trim()}`);
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  // Wait for INFRA_READY (or runner exit / timeout).
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          '[pw global-setup] Infrastructure did not become ready within 120s.\n' +
            `--- runner output ---\n${buffered}\n--- end ---`,
        ),
      );
    }, 120_000);

    const check = setInterval(() => {
      if (buffered.includes('INFRA_READY')) {
        clearInterval(check);
        clearTimeout(timeout);
        console.log('[pw global-setup] Infrastructure ready.');
        resolve();
      }
    }, 250);

    child.on('exit', (code) => {
      clearInterval(check);
      clearTimeout(timeout);
      if (!buffered.includes('INFRA_READY')) {
        reject(
          new Error(
            `[pw global-setup] Infra runner exited early (code ${code}).\n` +
              `--- runner output ---\n${buffered}\n--- end ---`,
          ),
        );
      }
    });
  });
}

export default globalSetup;
