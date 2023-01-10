import { ConsoleManager, defineGlobalEnv } from '@travetto/base';
import { TestWatcher } from '../src/execute/watcher';

export async function main(format: string = 'tap', runAllOnStart: string = 'true'): Promise<void> {
  defineGlobalEnv({ test: true, dynamic: true });
  ConsoleManager.setDebugFromEnv();
  await TestWatcher.watch(format, runAllOnStart !== 'false');
}