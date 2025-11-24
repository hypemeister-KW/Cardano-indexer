import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}

