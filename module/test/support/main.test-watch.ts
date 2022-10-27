import { PhaseManager } from '@travetto/boot';

import { envInit } from './bin/env';
import { TestWatcher } from '../src/execute/watcher';

export async function main(format: string = 'tap'): Promise<void> {
  envInit(true);

  // Compile everything inline, don't delegate
  await PhaseManager.run('init', '@trv:boot/load');

  await TestWatcher.watch(format);
}