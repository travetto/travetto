import * as fs from 'fs';
import { AppCache } from '@travetto/boot';
import { CliUtil } from '@travetto/cli/src/util';
import { CompileCliUtil } from '@travetto/compiler/bin/lib';
import type { RunState } from '../../src/execute/types';

const DEF_ENV = { env: 'test', debug: '0', resources: ['test/resources'], profiles: ['test'] };
const ENV_EXT = { TRV_LOG_TIME: 0 };

async function customLogs() {
  const { ConsoleManager } = await import('@travetto/base');

  const c = new console.Console({
    stdout: fs.createWriteStream(AppCache.toEntryName(`test-worker.${process.pid}.log`), { flags: 'a' }),
    inspectOptions: { depth: 4 },
  });

  ConsoleManager.set({
    onLog: (level, ctx, args: unknown[]) => c[level](process.pid, ctx, ...args)
  });
}

async function load() {
  process.env.TRV_SRC_LOCAL = `^test,${process.env.TRV_SRC_LOCAL ?? ''}`;
  process.env.TRV_SRC_COMMON = `^test-support,${process.env.TRV_SRC_COMMON ?? ''}`;

  await CompileCliUtil.compile();
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:compiler/load');
}

/**
 * Run tests given the input state
 * @param opts
 */
export async function runTests(opts: RunState) {
  CliUtil.initEnv({ ...DEF_ENV, envExtra: ENV_EXT, watch: false });
  await load();
  const { StandardWorker } = await import('../../src/worker/standard');
  return StandardWorker.run(opts);
}

export async function runTestsDirect(...args: string[]) {
  CliUtil.initEnv({ ...DEF_ENV, envExtra: ENV_EXT });
  await load();

  return runTests({
    args,
    format: process.env.TRV_TEST_FORMAT ?? 'tap',
    mode: 'single',
    concurrency: 1
  });
}

export async function worker() {
  CliUtil.initEnv({ ...DEF_ENV, envExtra: ENV_EXT });
  await customLogs();
  await load();

  const { TestChildWorker } = await import('../../src/worker/child');
  return new TestChildWorker().activate();
}

export async function watchTests(format: string = 'tap') {
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