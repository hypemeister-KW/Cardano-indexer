import Fastify from 'fastify';
import { createDatabasePool } from './config/database';
import { createBlockfrostClient } from './config/blockfrost';
import { createTables } from './database/schema';
import { resetSyncState } from './database/repositories/sync-state.repository';
import { syncBlockchain } from './services/sync.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerResetRoutes } from './routes/reset.routes';
import { registerAddressesRoutes } from './routes/addresses.routes';
import { registerTransactionsRoutes } from './routes/transactions.routes';


const fastify = Fastify({ logger: true });

async function bootstrap() {
  console.log('🚀 Bootstrapping...');

  const pool = createDatabasePool();
  const blockfrost = await createBlockfrostClient();

  await createTables(pool);
  await resetSyncState(pool, parseInt(process.env.START_BLOCK || '10000000'));

  (fastify as any).pool = pool;

  // Register routes
  await registerHealthRoutes(fastify);
  await registerResetRoutes(fastify);
  await registerAddressesRoutes(fastify);
  await registerTransactionsRoutes(fastify);
  //await registerRollbackRoutes(fastify);

  // Start sync interval
  setInterval(() => syncBlockchain(pool, blockfrost), 30000);

  // Initial sync
  await syncBlockchain(pool, blockfrost);

  console.log('✅ Bootstrap completed');
}

try {
  await bootstrap();
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  await fastify.listen({
    port,
    host
  });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
