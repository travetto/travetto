import fs from 'fs/promises';

import { ConsoleManager, defineGlobalEnv } from '@travetto/base';
import { path } from '@travetto/manifest';

import { TestChildWorker } from '../src/worker/child';

export async function customLogs(): Promise<void> {
  if (/\b@travetto[/]test\b/.test(process.env.DEBUG ?? '')) {
    const handle = await fs.open(path.resolve(`.trv-test-worker.${process.pid}.log`), 'a');
    const stdout = handle.createWriteStream();

    const c = new console.Console({
      stdout,
      inspectOptions: { depth: 4 },
    });

    ConsoleManager.set({
      onLog: (ev) => c[ev.level](process.pid, ...ev.args)
    });
  } else {
    ConsoleManager.set({ onLog: () => { } });
  }
}

export async function main(): Promise<void> {
  defineGlobalEnv({ test: true });
  ConsoleManager.setDebugFromEnv();

  await customLogs();
  return new TestChildWorker().activate();
}
