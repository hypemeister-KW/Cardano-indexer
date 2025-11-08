import type { FastifyInstance } from 'fastify';
import { getTransaction } from '../database/repositories/transactions.repository';

export async function registerTransactionsRoutes(fastify: FastifyInstance) {
  fastify.get('/transactions/:txHash', async (request, reply) => {
    const { txHash } = request.params as { txHash: string };
    const pool = (fastify as any).pool;

    try {
      const result = await getTransaction(pool, txHash);

      if (!result) {
        return reply.code(404).send({ error: 'Transaction not found' });
      }

      return result;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

