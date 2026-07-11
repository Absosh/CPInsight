/*
 * Production job entrypoint placeholder.
 *
 * Recommended implementation:
 * - Use BullMQ or a managed queue.
 * - Enqueue per connected platform account.
 * - Acquire Redis sync-lock:{platform}:{handle} before upstream calls.
 * - Persist normalized rows into contest_history and submission_history.
 * - Mark platform_accounts.last_synced_at and sync_status.
 * - Recompute analytics_cache after successful sync.
 */
async function syncPlatformsJob() {
  throw new Error('syncPlatformsJob is not wired yet; implement with a queue worker before enabling.');
}

module.exports = syncPlatformsJob;
