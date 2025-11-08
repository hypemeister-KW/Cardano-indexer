import { Pool } from 'pg';

export async function getLastSyncedBlock(pool: Pool): Promise<number> {
  const result = await pool.query('SELECT last_synced_block FROM sync_state WHERE id = 1');
  return result.rows[0]?.last_synced_block ?? 10000000;
}

export async function updateLastSyncedBlock(pool: Pool, blockHeight: number): Promise<void> {
  await pool.query(
    'UPDATE sync_state SET last_synced_block = $1, last_synced_at = CURRENT_TIMESTAMP WHERE id = 1',
    [blockHeight]
  );
}

export async function resetSyncState(pool: Pool, startBlock: number = 10000000): Promise<void> {
  try {
    await pool.query(
      'UPDATE sync_state SET last_synced_block = $1, last_synced_at = CURRENT_TIMESTAMP WHERE id = 1',
      [startBlock]
    );
    console.log(`Sync state reset to block ${startBlock}`);
  } catch (error) {
    console.error('Error resetting sync state:', error);
    throw error;
  }
}

