import { EnvInit } from '@travetto/base/bin/init';

export async function main(format: string = 'tap') {
  EnvInit.init({
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_RESOURCES: 'test/resources',
      TRV_PROFILES: 'test',
      TRV_SRC_LOCAL: 'test',
      TRV_SRC_COMMON: 'test-support'
    }
  });

  // Compile everything inline, don't delegate
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:compiler/load');

  // Trigger startup of transpiler
  (await import('@travetto/compiler')).Compiler['transpiler']['getProgram']();

  const { TestWatcher } = await import('../../src/execute/watcher');
  await TestWatcher.watch(format);
}