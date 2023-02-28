import path from 'path';

async function entry(): Promise<void> {
  const { init } = await import('@travetto/base/support/init.js');
  await init();
  try {
    const { ExecutionManager } = await import('@travetto/cli');
    await ExecutionManager.run(process.argv);
  } finally {
    // Denote intent to exit
    process.emit('SIGUSR2');
  }
}

entry().then(() => path);