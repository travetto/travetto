import { EnvInit } from '@travetto/base/support/bin/init';

export async function main(format: string = 'tap'): Promise<void> {
  EnvInit.init({
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    dynamic: true,
    append: {
      TRV_RESOURCES: 'test/resources',
      TRV_PROFILES: 'test',
      TRV_SRC_LOCAL: 'test',
      TRV_SRC_COMMON: '^test-support'
    }
  });

  // Compile everything inline, don't delegate
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:base/load');

  // Trigger startup of transpiler
  (await import('@travetto/compiler')).Compiler.getProgram();

  const { TestWatcher } = await import('../src/execute/watcher');
  await TestWatcher.watch(format);
}