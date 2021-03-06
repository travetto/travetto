import { CliUtil } from '@travetto/cli/src/util';
import { DEF_ENV, ENV_EXT } from './env';

export async function main(format: string = 'tap') {
  CliUtil.initEnv({
    ...DEF_ENV, watch: true, envExtra: {
      ...ENV_EXT,
      TRV_SRC_COMMON: 'test-support',
      TRV_SRC_LOCAL: 'test'
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