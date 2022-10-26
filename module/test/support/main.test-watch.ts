import { PhaseManager } from '@travetto/boot';

import { envInit } from './bin/env';

export async function main(format: string = 'tap'): Promise<void> {
  envInit(false, true);

  // Compile everything inline, don't delegate
  await PhaseManager.run('init', '@trv:base/load');

  const { TestWatcher } = await import('../src/execute/watcher');
  await TestWatcher.watch(format);
}