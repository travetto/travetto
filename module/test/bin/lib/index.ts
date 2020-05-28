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
  Object.assign(process.env, {
    DEBUG: process.env.DEBUG || '0',
    TRV_LOG_TIME: '0',
    TRV_WATCH: '0',
    TRV_ENV: 'test',
    TRV_RESOURCE_ROOTS: 'test',
    ...env
  });
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
  await load({ TRV_WATCH: 1, DEBUG: process.env.DEBUG ?? '0' });

  const { TestWatcher } = await import('../../src/runner/watcher');
  await TestWatcher.watch(format);
}