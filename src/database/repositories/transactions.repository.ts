import { Pool } from 'pg';
import type { Transaction } from '../../types';

export async function saveTransaction(pool: Pool, transaction: Transaction): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingTx = await client.query(
      'SELECT tx_hash FROM transactions WHERE tx_hash = $1',
      [transaction.tx_hash]
    );
    if (existingTx.rows.length > 0) {
      await client.query('ROLLBACK');
      console.log(`Transaction ${transaction.tx_hash} already exists, skipping`);
      return;
    }

    await client.query(
      'INSERT INTO transactions (tx_hash, block_height, block_time, inputs, outputs) VALUES ($1, $2, $3, $4, $5)',
      [
        transaction.tx_hash,
        transaction.block_height,
        transaction.block_time,
        JSON.stringify(transaction.inputs),
        JSON.stringify(transaction.outputs)
      ]
    );

    const { getOnCreateAddress } = await import('./addresses.repository');

    for (const input of transaction.inputs) {
      await getOnCreateAddress(client, input.address);
      await client.query(`
        UPDATE addresses 
        SET balance = balance - $1::BIGINT,
            transaction_count = transaction_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE address = $2
      `, [String(BigInt(input.amount)), input.address]);
    }

    for (const output of transaction.outputs) {
      await getOnCreateAddress(client, output.address);
      await client.query(`
        UPDATE addresses 
        SET balance = balance + $1::BIGINT,
            transaction_count = transaction_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE address = $2
      `, [String(BigInt(output.amount)), output.address]);
    }

    await client.query('COMMIT');
    console.log(`Transaction ${transaction.tx_hash} saved successfully with ${transaction.inputs.length} inputs and ${transaction.outputs.length} outputs`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error saving transaction ${transaction.tx_hash}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getTransaction(pool: Pool, txHash: string) {
  const result = await pool.query(
    'SELECT tx_hash, block_height, block_time, inputs, outputs FROM transactions WHERE tx_hash = $1',
    [txHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    txHash: result.rows[0].tx_hash,
    blockHeight: result.rows[0].block_height,
    blockTime: result.rows[0].block_time,
    inputs: result.rows[0].inputs,
    outputs: result.rows[0].outputs,
  };
}

export async function clearAllTransactions(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM transactions');
}

export async function rollbackToHeight(pool: Pool, targetHeight: number): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    
    const result = await client.query(
      'SELECT tx_hash, block_height, inputs, outputs FROM transactions WHERE block_height > $1 ORDER BY block_height DESC',
      [targetHeight]
    );

    const transactions = result.rows;
    let rollbackCount = 0;

    const { getOnCreateAddress } = await import('./addresses.repository');

    for (const tx of transactions) {
      const inputs = tx.inputs as Array<{ address: string; amount: string }>;
      const outputs = tx.outputs as Array<{ address: string; amount: string }>;


      for (const input of inputs) {
        await getOnCreateAddress(client, input.address);
        await client.query(`
          UPDATE addresses 
          SET balance = balance + $1::BIGINT,
              transaction_count = GREATEST(transaction_count - 1, 0),
              updated_at = CURRENT_TIMESTAMP
          WHERE address = $2
        `, [String(BigInt(input.amount)), input.address]);
      }

      // Reverse outputs: subtract the amount (undo receiving)
      for (const output of outputs) {
        await getOnCreateAddress(client, output.address);
        await client.query(`
          UPDATE addresses 
          SET balance = balance - $1::BIGINT,
              transaction_count = GREATEST(transaction_count - 1, 0),
              updated_at = CURRENT_TIMESTAMP
          WHERE address = $2
        `, [String(BigInt(output.amount)), output.address]);
      }

      rollbackCount++;
    }

    
    await client.query(
      'DELETE FROM transactions WHERE block_height > $1',
      [targetHeight]
    );

    await client.query(
      'UPDATE sync_state SET last_synced_block = $1, last_synced_at = CURRENT_TIMESTAMP WHERE id = 1',
      [targetHeight]
    );

    await client.query('COMMIT');
    console.log(`Rolled back ${rollbackCount} transactions to height ${targetHeight}`);
    return rollbackCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error rolling back to height ${targetHeight}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

