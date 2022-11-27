import fs from 'fs/promises';

import { path, ConsoleManager } from '@travetto/boot';

import { envInit } from './bin/env';
import { TestChildWorker } from '../src/worker/child';

export async function customLogs(): Promise<void> {
  if (process.env.DEBUG?.includes('test-worker')) {
    const handle = await fs.open(path.resolve(`.trv-test-worker.${process.pid}.log`), 'a');
    const stdout = handle.createWriteStream();

    const c = new console.Console({
      stdout,
      inspectOptions: { depth: 4 },
    });

    ConsoleManager.set({
      onLog: (level, ctx, args: unknown[]) => c[level](process.pid, ctx, ...args)
    });
  } else {
    ConsoleManager.set({ onLog: (level, ctx, args: unknown[]) => { } });
  }
}

export async function main(): Promise<void> {
  envInit();

  await customLogs();

  return new TestChildWorker().activate();
}
