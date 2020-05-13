import { State } from '../src/runner/types';

// TODO: Document

export async function runTests(opts: State) {
  const { StandardWorker } = await import('../src/worker/standard');
  return StandardWorker.run(opts);
}

export async function load(env: any = {}) {
  Object.assign(process.env, {
    DEBUG: process.env.DEBUG || '0',
    TRACE: process.env.TRACE || '0',
    TRV_LOG_TIME: '0',
    TRV_WATCH: '0',
    TRV_ENV: 'test',
    TRV_RESOURCE_ROOTS: 'test',
    ...env
  });
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.bootstrap('require-all');
}

export async function runTestsDirect(format: string = 'tap', mode: any = 'single', concurrency = 1) {
  await load({ TRV_TEST_DEBUGGER: true });

  return runTests({
    args: process.argv.slice(2),
    format,
    mode,
    concurrency
  });
}

export async function worker() {
  await load();

  const { TestChildWorker } = await import('../src/worker/child');
  return new TestChildWorker().activate();
}

export async function watchTests(format: string = 'event') {
  await load({ TRV_WATCH: 1, DEBUG: 0 });

  const { TestWatcher } = await import('../src/runner/watcher');
  await TestWatcher.watch(format);
}