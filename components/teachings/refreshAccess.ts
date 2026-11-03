import syncService from '@/services/syncService';

/**
 * A new grant changes what the account may open, but the user object and the cached event
 * lists were read before it. Re-read both so the recordings show up without a reload.
 * Never throws: opening the recordings must not depend on this succeeding.
 */
export async function refreshAccess(refreshUserData: () => Promise<void>): Promise<void> {
  await Promise.allSettled([
    (async () => refreshUserData())(),
    (async () => syncService.checkAndSync({ force: true }))(),
  ]);
}
