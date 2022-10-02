import { envInit } from './bin/env';

export async function main(format: string = 'tap'): Promise<void> {
  envInit(false, true);

  // Compile everything inline, don't delegate
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:base/load');

  // Trigger startup of transpiler
  (await import('@travetto/compiler')).Compiler.getProgram();

  const { TestWatcher } = await import('../src/execute/watcher');
  await TestWatcher.watch(format);
}