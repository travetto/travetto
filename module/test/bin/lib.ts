import { EnvUtil } from '@travetto/boot/src/env';
import { State } from '../src/runner/runner';

export function prepareEnv(extra = {}) {
  Object.assign(process.env, {
    QUIET_INIT: '1',
    DEBUG: process.env.DEBUG || '0',
    TRACE: '0',
    PROD: '0',
    LOG_TIME: '0',
    WATCH: '0',
    ENV: 'test',
    RESOURCE_ROOTS: 'test',
    ...extra
  });
}

export async function runTests(opts: State) {
  const { StandardWorker } = await import('../src/worker/standard');
  return StandardWorker.run(opts);
}

export async function worker() {
  prepareEnv();
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init('bootstrap', 'compiler').run();

  const { TestChildWorker } = await import('../src/worker/child');
  return new TestChildWorker().activate();
}

export async function runTestsDirect() {
  prepareEnv({ DEBUGGER: true });

  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run();

  return runTests(
    {
      args: process.argv.slice(2),
      format: EnvUtil.get('TEST_FORMAT', 'tap'),
      mode: EnvUtil.get('TEST_MODE', 'single') as any,
      concurrency: EnvUtil.getInt('TEST_CONCURRENCY', 1)
    }
  );
}

export async function watchTests() {
  prepareEnv({ WATCH: 1, DEBUG: 0 });
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init('bootstrap', 'compiler').run();

  const { TestWatcher } = await import('../src/runner/watcher');
  await TestWatcher.watch(EnvUtil.get('TEST_FORMAT', 'event'));
}