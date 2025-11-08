import type { FastifyInstance } from 'fastify';
import { resetSyncState } from '../database/repositories/sync-state.repository';
import { clearAllTransactions } from '../database/repositories/transactions.repository';
import { clearAllAddresses } from '../database/repositories/addresses.repository';

export async function registerResetRoutes(fastify: FastifyInstance) {
  fastify.post('/reset', async (request, reply) => {
    const pool = (fastify as any).pool;
    const body = request.body as { block?: number; clearData?: boolean } || {};
    const { block = 10000000, clearData = false } = body;

    try {
      if (clearData) {
        await clearAllTransactions(pool);
        await clearAllAddresses(pool);
        console.log('Cleared all transactions and addresses');
      }

      await resetSyncState(pool, block);
      return {
        success: true,
        message: `Sync state reset to block ${block}`,
        dataCleared: clearData
      };
    } catch (error) {
      console.error('Error in reset endpoint:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/reset', async (request, reply) => {
    const pool = (fastify as any).pool;
    const { block = '10000000', clearData = 'false' } = request.query as { block?: string; clearData?: string };

    try {
      const blockNum = parseInt(block);
      const shouldClearData = clearData === 'true';

      if (shouldClearData) {
        await clearAllTransactions(pool);
        await clearAllAddresses(pool);
        console.log('Cleared all transactions and addresses');
      }

      await resetSyncState(pool, blockNum);
      return {
        success: true,
        message: `Sync state reset to block ${blockNum}`,
        dataCleared: shouldClearData
      };
    } catch (error) {
      console.error('Error in reset endpoint:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

