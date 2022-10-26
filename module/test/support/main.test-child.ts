import * as fs from 'fs/promises';
import * as path from 'path';

import { envInit } from './bin/env';

export async function customLogs(): Promise<void> {
  const { ConsoleManager } = await import('@travetto/boot');

  const handle = await fs.open(path.resolve(`.trv-test-worker.${process.pid}.log`).__posix, 'a');
  const stdout = handle.createWriteStream();

  const c = new console.Console({
    stdout,
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
