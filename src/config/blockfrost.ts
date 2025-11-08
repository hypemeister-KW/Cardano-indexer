export async function createBlockfrostClient() {
  const blockfrostProjectId = process.env.BLOCKFROST_PROJECT_ID;

  if (!blockfrostProjectId) {
    throw new Error('BLOCKFROST_PROJECT_ID is required');
  }

  const { BlockFrostAPI } = await import('@blockfrost/blockfrost-js');
  return new BlockFrostAPI({
    projectId: blockfrostProjectId,
    network: 'mainnet',
  });
}

