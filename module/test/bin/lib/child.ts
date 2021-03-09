import * as fs from 'fs';

import { AppCache } from '@travetto/boot';
import { CompileCliUtil } from '@travetto/compiler/bin/lib';
import { EnvInit } from '@travetto/base/bin/init';

export async function customLogs() {
  const { ConsoleManager } = await import('@travetto/base');

  const c = new console.Console({
    stdout: fs.createWriteStream(AppCache.toEntryName(`test-worker.${process.pid}.log`), { flags: 'a' }),
    inspectOptions: { depth: 4 },
  });

  ConsoleManager.set({
    onLog: (level, ctx, args: unknown[]) => c[level](process.pid, ctx, ...args)
  });
}

export async function main() {
  EnvInit.init({
    debug: '0',
    set: { TRV_LOG_TIME: '0' },
    append: {
      TRV_RESOURCES: 'test/resources',
      TRV_PROFILES: 'test',
      TRV_SRC_LOCAL: '^test',
      TRV_SRC_COMMON: '^test-support'
    }
  });

  await customLogs();

  await CompileCliUtil.compile();
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:compiler/load');

  const { TestChildWorker } = await import('../../src/worker/child');
  return new TestChildWorker().activate();
}
