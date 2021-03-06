import * as fs from 'fs';

import { AppCache } from '@travetto/boot';
import { CliUtil } from '@travetto/cli/src/util';
import { DEF_ENV, ENV_EXT, load } from './env';

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
  CliUtil.initEnv({ ...DEF_ENV, envExtra: ENV_EXT });
  await customLogs();
  await load();

  const { TestChildWorker } = await import('../../src/worker/child');
  return new TestChildWorker().activate();
}
