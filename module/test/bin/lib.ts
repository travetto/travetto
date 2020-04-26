import { EnvUtil } from '@travetto/boot/src/env';
import { State } from '../src/runner/types';

export async function runTests(opts: State) {
  const { StandardWorker } = await import('../src/worker/standard');
  return StandardWorker.run(opts);
}

export async function load(env: any = {}) {
  Object.assign(process.env, {
    QUIET_INIT: '1',
    DEBUG: process.env.DEBUG || '0',
    TRACE: process.env.TRACE || '0',
    PROD: '0',
    LOG_TIME: '0',
    WATCH: '0',
    ENV: 'test',
    RESOURCE_ROOTS: 'test',
    ...env
  });
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.bootstrap('require-all');
}

export async function runTestsDirect() {
  await load({ DEBUGGER: true });

  return runTests({
    args: process.argv.slice(2),
    format: EnvUtil.get('TEST_FORMAT', 'tap'),
    mode: EnvUtil.get('TEST_MODE', 'single') as any,
    concurrency: EnvUtil.getInt('TEST_CONCURRENCY', 1)
  });
}

export async function worker() {
  await load();

  const { TestChildWorker } = await import('../src/worker/child');
  return new TestChildWorker().activate();
}

export async function watchTests() {
  await load({ WATCH: 1, DEBUG: 0 });

  const { TestWatcher } = await import('../src/runner/watcher');
  await TestWatcher.watch(EnvUtil.get('TEST_FORMAT', 'event'));
}