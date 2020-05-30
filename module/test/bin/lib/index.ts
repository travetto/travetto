import { CliUtil } from '@travetto/cli/src/util';
import { RunState } from '../../src/runner/types';

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState) {
  const { StandardWorker } = await import('../../src/worker/standard');
  return StandardWorker.run(opts);
}

export async function load(env: any = {}, logToFile = false) {
  Object.assign(process.env, { ...env, TRV_LOG_TIME: '0' });
  CliUtil.initAppEnv({ env: 'test', debug: '0', resourceRoots: ['test'] });

  const { PhaseManager, ConsoleManager } = await import('@travetto/base');
  if (logToFile) {
    ConsoleManager.setFile(`!test-worker.${process.pid}.log`, {
      processArgs: (payload, args: any[]) => [process.pid, ...args]
    });
  }
  await PhaseManager.init('require-all');
}

export async function runTestsDirect(...args: string[]) {
  await load({ TRV_TEST_DEBUGGER: true });

  return runTests({
    args,
    format: 'tap',
    mode: 'single',
    concurrency: 1
  });
}

export async function worker() {
  await load({}, true);

  const { TestChildWorker } = await import('../../src/worker/child');
  return new TestChildWorker().activate();
}

export async function watchTests(format: string = 'tap') {
  await load({ TRV_WATCH: 1 });

  const { TestWatcher } = await import('../../src/runner/watcher');
  await TestWatcher.watch(format);
}