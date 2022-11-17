import { envInit } from './bin/env';
import { TestWatcher } from '../src/execute/watcher';

export async function main(format: string = 'tap'): Promise<void> {
  envInit(true);

  await TestWatcher.watch(format);
}