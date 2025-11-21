import { Pool } from 'pg';

export async function getOnCreateAddress(client: any, address: string): Promise<void> {
  await client.query(`
    INSERT INTO addresses (address, balance, transaction_count)
    VALUES ($1, 0, 0)
    ON CONFLICT (address) DO NOTHING;
  `, [address]);
}

export async function getAddress(pool: Pool, address: string) {
  const result = await pool.query(
    'SELECT address, balance, transaction_count FROM addresses WHERE address = $1',
    [address]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    address: result.rows[0].address,
    balance: result.rows[0].balance,
    transactionCount: result.rows[0].transaction_count,
  };
}

export async function getAddressTransactions(
  pool: Pool,
  address: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;
  const result = await pool.query(`
    SELECT tx_hash, block_height, block_time, inputs, outputs
    FROM transactions
    WHERE inputs::text LIKE $1 OR outputs::text LIKE $1
    ORDER BY block_height DESC
    LIMIT $2 OFFSET $3
  `, [`%${address}%`, limit, offset]);

  return {
    transactions: result.rows.map((row: any) => ({
      txHash: row.tx_hash,
      blockHeight: row.block_height,
      blockTime: row.block_time,
      inputs: row.inputs,
      outputs: row.outputs,
    })),
    page,
    limit,
  };
}

export async function getTopAddresses(pool: Pool, limit: number) {
  const result = await pool.query(`
    SELECT address, balance, transaction_count
    FROM addresses
    WHERE balance > 0
    ORDER BY balance DESC
    LIMIT $1
  `, [limit]);

  return {
    topAddresses: result.rows.map((row: any) => ({
      address: row.address,
      balance: row.balance,
      transactionCount: row.transaction_count,
    })),
  };
}

export async function clearAllAddresses(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM addresses');
}

