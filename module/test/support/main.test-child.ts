import * as fs from 'fs/promises';

import * as path from '@travetto/path';
import { ConsoleManager, PhaseManager } from '@travetto/boot';

import { envInit } from './bin/env';
import { TestChildWorker } from '../src/worker/child';

export async function customLogs(): Promise<void> {
  const handle = await fs.open(path.resolve(`.trv-test-worker.${process.pid}.log`), 'a');
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

  await PhaseManager.run('init', '@trv:boot/load');

  return new TestChildWorker().activate();
}
