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
  try {
    await setup();
    return ExecUtil.returnResponse(0, await action(...args));
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    return ExecUtil.returnResponse((err as any)?.code ?? 1, err);
  }
}

export const runIfMain = (target: Function, filename: string, mainFile: string): unknown =>
  (RootIndex.getSourceFile(filename) === RootIndex.getSourceFile(process.env.TRV_MAIN || mainFile)) ?
    runMain(target, process.argv.slice(2)) : undefined;