import { install } from 'source-map-support';

import { path, RootIndex } from '@travetto/manifest';

import { ConsoleManager } from '../src/console';
import { ExecUtil } from '../src/exec';
import { ShutdownManager } from '../src/shutdown';
import { defineGlobalEnv, GlobalEnv } from '../src/global-env';

const RESET_CODE = ['?25h', 's', 'r', 'u'].map(c => `\x1b[${c}`).join('');

// Setup everything
let initialized = false;
export async function setup(): Promise<void> {
  if (initialized) {
    return;
  }

  initialized = true;

  // Read .env setup
  try { await import(path.resolve('.env')); } catch { }

  // @ts-expect-error -- Lock to prevent __proto__ pollution in JSON
  const objectProto = Object.prototype.__proto__;
  Object.defineProperty(Object.prototype, '__proto__', {
    get() { return objectProto; },
    set(val) { Object.setPrototypeOf(this, val); }
  });

  // Setup stack traces
  Error.stackTraceLimit = 50; // Deep limit
  install(); // Register source maps

  defineGlobalEnv({ main: undefined });

  // Initialize
  await ConsoleManager.register();

  // Register shutdown handler
  ShutdownManager.register();

  // This could live in @travetto/terminal, but orchestrating is complicated
  if (process.stdout.isTTY) {
    // Ensure cursor comes back, on exit
    ShutdownManager.onShutdown('', () => process.stdout.write(RESET_CODE));
  }

  try {
    const { TerminalUtil, COLOR_INIT } = await import('@travetto/terminal');
    await COLOR_INIT;
    ShutdownManager.onShutdown('', () => TerminalUtil.drainReading());
  } catch { }
}

export async function runMain(action: Function, args: string[]): Promise<void> {
  try {
    await setup();
    ExecUtil.returnResponse(0, await action(...args));
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    ExecUtil.returnResponse((err as any)?.code ?? 1, err);
  }
}

export const runIfMain = (target: Function, filename: string, mainFile: string): unknown =>
  (RootIndex.getSourceFile(filename) === RootIndex.getSourceFile(GlobalEnv.main || mainFile)) ?
    runMain(target, process.argv.slice(2)) : undefined;

