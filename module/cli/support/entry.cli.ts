import path from 'path';

async function entry(): Promise<void> {
  const { init, cleanup } = await import('@travetto/base/support/init.js');
  await init();
  try {
    const { ExecutionManager } = await import('@travetto/cli');
    await ExecutionManager.run(process.argv);
  } finally {
    await cleanup();
  }
}

entry().then(() => path);