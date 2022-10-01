import { createWriteStream } from 'fs';

import { AppCache, Host } from '@travetto/boot';
import { EnvInit } from '@travetto/base/support/bin/init';

export async function customLogs(): Promise<void> {
  const { ConsoleManager } = await import('@travetto/base');

  const c = new console.Console({
    stdout: createWriteStream(AppCache.toEntryName(`test-worker.${process.pid}.log`), { flags: 'a' }),
    inspectOptions: { depth: 4 },
  });

  ConsoleManager.set({
    onLog: (level, ctx, args: unknown[]) => c[level](process.pid, ctx, ...args)
  });
}

export async function main(): Promise<void> {
  EnvInit.init({
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_RESOURCES: `${Host.PATH.test}/${Host.PATH.resources}`,
      TRV_PROFILES: 'test',
      TRV_SRC_LOCAL: `^${Host.PATH.test}`,
      TRV_SRC_COMMON: `^${Host.PATH.testSupport}`
    }
  });

  await customLogs();

  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:base/load');

  const { TestChildWorker } = await import('../src/worker/child');
  return new TestChildWorker().activate();
}
