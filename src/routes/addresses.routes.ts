import type { FastifyInstance } from 'fastify';
import { getAddress, getAddressTransactions, getTopAddresses } from '../database/repositories/addresses.repository';

export async function registerAddressesRoutes(fastify: FastifyInstance) {
  fastify.get('/addresses/:address', async (request, reply) => {
    const { address } = request.params as { address: string };
    const pool = (fastify as any).pool;

    try {
      const result = await getAddress(pool, address);

      if (!result) {
        return reply.code(404).send({ error: 'Address not found' });
      }

      return result;
    } catch (error) {
      console.error('Error fetching address:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/addresses/:address/transactions', async (request, reply) => {
    const { address } = request.params as { address: string };
    const { page = '1', limit = '10' } = request.query as { page?: string; limit?: string };
    const pool = (fastify as any).pool;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
      return await getAddressTransactions(pool, address, pageNum, limitNum);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/top-addresses', async (request, reply) => {
    const { limit = '10' } = request.query as { limit?: string };
    const pool = (fastify as any).pool;
    const limitNum = parseInt(limit);

    try {
      return await getTopAddresses(pool, limitNum);
    } catch (error) {
      console.error('Error fetching top addresses:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

