import { createWriteStream } from 'fs';

import { AppCache } from '@travetto/boot';

import { envInit } from './bin/env';

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
  envInit();

  await customLogs();

  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init', '@trv:base/load');

  const { TestChildWorker } = await import('../src/worker/child');
  return new TestChildWorker().activate();
}
