import { Pool } from 'pg';
import type { Transaction } from '../types';
import { getLastSyncedBlock, updateLastSyncedBlock, resetSyncState } from '../database/repositories/sync-state.repository';
import { saveTransaction } from '../database/repositories/transactions.repository';

export async function syncBlockchain(pool: Pool, blockfrost: any): Promise<void> {
  try {
    let lastSyncedBlock = await getLastSyncedBlock(pool);
    const startBlock = parseInt(process.env.START_BLOCK || '10000000', 10);


    if (lastSyncedBlock < startBlock) {
      console.log(`Current block ${lastSyncedBlock}`);
      await resetSyncState(pool, startBlock);
      lastSyncedBlock = startBlock;
    }

    const latestBlock = await blockfrost.blocksLatest();
    const latestBlockHeight = latestBlock.height || 0;

    console.log(`Syncing from block ${lastSyncedBlock} to ${latestBlockHeight}`);

    const batchSize = 10;
    const endBlock = Math.min(lastSyncedBlock + batchSize, latestBlockHeight);
    const syncToBlock = parseInt(process.env.START_BLOCK || '10000000', 10) + 20;

    for (let blockHeight = lastSyncedBlock + 1; blockHeight <= endBlock; blockHeight++) {
      if (blockHeight > syncToBlock) {
        console.log(`Syncing to block ${syncToBlock}`);
        break;
      }
      try {
        const block = await blockfrost.blocks(blockHeight.toString());
        let txHashes = await blockfrost.blocksTxs(block.hash);

        if (txHashes && txHashes.length > 0 && typeof txHashes[0] === 'object') {
          console.log(`blocksTxs returned objects, extracting hashes. First item:`, JSON.stringify(txHashes[0]));
          txHashes = txHashes.map((tx: any) => tx.tx_hash || tx.hash || tx);
        }

        if (txHashes.length === 0) {
          console.log(`Processing block ${blockHeight} with 0 transactions - skipping`);
        } else {
          console.log(`Processing block ${blockHeight} with ${txHashes.length} transactions`);
          console.log(`First few tx hashes:`, txHashes.slice(0, 3));
        }

        for (const txHash of txHashes) {
          try {
            console.log(`Fetching UTXOs for transaction ${txHash}`);
            const utxos = await blockfrost.txsUtxos(txHash);

            console.log(`UTXOs response for ${txHash}:`, JSON.stringify({
              inputsCount: utxos.inputs?.length || 0,
              outputsCount: utxos.outputs?.length || 0,
              inputs: utxos.inputs?.slice(0, 2),
              outputs: utxos.outputs?.slice(0, 2),
            }));

            if (!utxos.inputs || !utxos.outputs) {
              console.warn(`Transaction ${txHash} has no inputs or outputs, skipping`);
              continue;
            }

            const inputs = utxos.inputs.map((input: any) => {
              const lovelaceAmount = Array.isArray(input.amount)
                ? input.amount.find((a: any) => a.unit === 'lovelace')?.quantity || '0'
                : (input.amount?.find((a: any) => a.unit === 'lovelace')?.quantity || '0');
              return {
                address: input.address || '',
                amount: lovelaceAmount,
                tx_hash: txHash,
              };
            }).filter((input: any) => input.address);

            const outputs = utxos.outputs.map((output: any) => {
              const lovelaceAmount = Array.isArray(output.amount)
                ? output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || '0'
                : (output.amount?.find((a: any) => a.unit === 'lovelace')?.quantity || '0');
              return {
                address: output.address || '',
                amount: lovelaceAmount,
              };
            }).filter((output: any) => output.address);

            if (inputs.length === 0 && outputs.length === 0) {
              console.warn(`Transaction ${txHash} has no valid inputs or outputs after filtering, skipping`);
              continue;
            }

            const transaction: Transaction = {
              tx_hash: txHash,
              block_height: blockHeight,
              block_time: block.time || 0,
              inputs,
              outputs,
            };

            console.log(`Saving transaction ${txHash} with ${inputs.length} inputs and ${outputs.length} outputs`);
            await saveTransaction(pool, transaction);
          } catch (txError) {
            console.error(`Error processing transaction ${txHash}:`, txError);
            if ((txError as any).response) {
              console.error(`API Response:`, JSON.stringify((txError as any).response));
            }
          }
        }

        await updateLastSyncedBlock(pool, blockHeight);

        if (txHashes.length === 0) {
          console.log(`Block ${blockHeight} processed and marked as synced (0 transactions)`);
        }
      } catch (blockError) {
        console.error(`Error processing block ${blockHeight}:`, blockError);
        try {
          await updateLastSyncedBlock(pool, blockHeight);
          console.log(`Block ${blockHeight} marked as synced despite error to avoid getting stuck`);
        } catch (updateError) {
          console.error(`Failed to update sync_state for block ${blockHeight}:`, updateError);
        }
        continue;
      }
    }

    console.log('Sync completed');
  } catch (error) {
    console.error('Sync error:', error);
  }
}

