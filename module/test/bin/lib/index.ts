import { CliUtil } from '@travetto/cli/src/util';
import { CompileCliUtil } from '@travetto/compiler/bin/lib/util';
import type { RunState } from '../../src/runner/types';

const DEF_ENV = { env: 'test', debug: '0', resourceRoots: ['test'] };
const ENV_EXT = { TRV_LOG_TIME: 0 };


async function customLogs() {
  const { ConsoleManager } = await import('@travetto/base');
  ConsoleManager.setFile(`!test-worker.${process.pid}.log`, {
    processArgs: (payload, args: any[]) => [process.pid, ...args]
  });
}

async function load() {
  await CompileCliUtil.compile();
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init('require-all');
}

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState) {
  CliUtil.initAppEnv({ ...DEF_ENV, envExtra: ENV_EXT });
  await load();
  const { StandardWorker } = await import('../../src/worker/standard');
  return StandardWorker.run(opts);
}

export async function runTestsDirect(...args: string[]) {
  CliUtil.initAppEnv({ ...DEF_ENV, envExtra: { ...ENV_EXT, TRV_TEST_DEBUGGER: 1 } });
  await load();

  return runTests({
    args,
    format: 'tap',
    mode: 'single',
    concurrency: 1
  });
}

export async function worker() {
  CliUtil.initAppEnv({ ...DEF_ENV, envExtra: ENV_EXT });
  await customLogs();
  await load();

  const { TestChildWorker } = await import('../../src/worker/child');
  return new TestChildWorker().activate();
}

export async function watchTests(format: string = 'tap') {
  CliUtil.initAppEnv({ ...DEF_ENV, watch: true, envExtra: { ...ENV_EXT, TRV_TEST_COMPILE: 1 } });
  await load();

  const { TestWatcher } = await import('../../src/runner/watcher');
  await TestWatcher.watch(format);
}