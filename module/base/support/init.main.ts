import { install } from 'source-map-support';

import { path, RootIndex } from '@travetto/manifest';

import { ConsoleManager } from '../src/console';
import { ExecUtil } from '../src/exec';
import { ShutdownManager } from '../src/shutdown';

// Setup everything
let initialized = false;
export async function setup(): Promise<void> {
  if (initialized) {
    return;
  }

  initialized = true;

  // Read .env setup
  try { await import(path.resolve('.env')); } catch { }

  // Delete if set
  delete process.env.TRV_MAIN;

  // @ts-expect-error -- Lock to prevent __proto__ pollution in JSON
  const objectProto = Object.prototype.__proto__;
  Object.defineProperty(Object.prototype, '__proto__', {
    get() { return objectProto; },
    set(val) { Object.setPrototypeOf(this, val); }
  });

  // Setup stack traces
  Error.stackTraceLimit = 50; // Deep limit
  install(); // Register source maps

  // Register shutdown handler
  ShutdownManager.register();

  // Initialize
  await ConsoleManager.register();
}

export async function runMain(action: Function, args: string[]): Promise<void> {
  let res: unknown | undefined;
  let exitCode = 0;

  try {
    await setup();
    res = await action(...args);
  } catch (err) {
    res = err;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    exitCode = (res instanceof Error) ? (res as { code?: number })['code'] ?? 1 : 1;
  }
  return ExecUtil.returnResponse(exitCode, res);
}

export const runIfMain = async (target: Function, filename: string, mainFile: string): Promise<unknown> =>
  (RootIndex.getSourceFile(filename) === RootIndex.getSourceFile(process.env.TRV_MAIN || mainFile)) ?
    runMain(target, process.argv.slice(2)) : undefined;