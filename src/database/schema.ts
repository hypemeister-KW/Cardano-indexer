import { Pool } from 'pg';

export async function createTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       email TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS addresses (
      address VARCHAR(255) PRIMARY KEY,
      balance BIGINT NOT NULL DEFAULT 0,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_addresses_balance 
    ON addresses(balance DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      tx_hash VARCHAR(255) PRIMARY KEY,
      block_height INTEGER NOT NULL,
      block_time BIGINT NOT NULL,
      inputs JSONB NOT NULL,
      outputs JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_block_height 
    ON transactions(block_height DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_synced_block INTEGER NOT NULL DEFAULT 10000000,
      last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT single_row CHECK (id = 1)
    );
  `);

  await pool.query(`
    INSERT INTO sync_state (id, last_synced_block) 
    VALUES (1, 10000000) 
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log('Tables created successfully');
}

