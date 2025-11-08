import type { FastifyInstance } from 'fastify';
import { rollbackToHeight } from '../database/repositories/transactions.repository';

export async function registerRollbackRoutes(fastify: FastifyInstance) {
  fastify.post('/rollback', async (request, reply) => {
    const pool = (fastify as any).pool;
    const { height } = request.query as { height?: string };

    if (!height) {
      return reply.code(400).send({ 
        error: 'Missing required query parameter: height' 
      });
    }

    const targetHeight = parseInt(height, 10);
    if (isNaN(targetHeight) || targetHeight < 0) {
      return reply.code(400).send({ 
        error: 'Invalid height parameter. Must be a non-negative integer.' 
      });
    }

    try {
      const rollbackCount = await rollbackToHeight(pool, targetHeight);
      return {
        success: true,
        message: `Rolled back to height ${targetHeight}`,
        transactionsRolledBack: rollbackCount,
        targetHeight
      };
    } catch (error) {
      console.error('Error in rollback endpoint:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

