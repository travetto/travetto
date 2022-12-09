import { install } from 'source-map-support';

import { path } from '@travetto/manifest';

import { ConsoleManager } from '../src/console';
import { ExecUtil } from '../src/exec';
import { ShutdownManager } from '../src/shutdown';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setToJSON = <T>(cons: abstract new (...args: any[]) => T, handler: (val: T, ...args: any[]) => unknown): void => {
  Object.defineProperty(cons.prototype, 'toJSON', {
    writable: false,
    // eslint-disable-next-line object-shorthand, @typescript-eslint/no-explicit-any
    value: function (this: T, ...args: any[]) { return handler(this, ...args); }
  });
};

// Setup everything
let initialized = false;
export async function setup(): Promise<void> {
  if (initialized) {
    return;
  } else {
    initialized = true;
  }

  // Read .env setup
  try { await import(path.resolve('.env')); } catch { }

  // Delete if set
  delete process.env.TRV_MAIN;

  // Remove to prevent __proto__ pollution in JSON
  const objectProto = Object.prototype.__proto__;
  Object.defineProperty(
    Object.prototype, '__proto__',
    {
      get() { return objectProto; },
      set(val) {
        Object.setPrototypeOf(this, val);
      }
    }
  );

  // Enable maps to be serialized as json
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  setToJSON(Map, val => ([...val.entries()] as [string, unknown][])
    .reduce<Record<string, unknown>>((acc, [k, v]) => { acc[k] = v; return acc; }, {}));

  // Enable sets to be serialized as JSON
  setToJSON(Set, val => [...val.values()]);

  // Add .toJSON to the default Error as well
  setToJSON(Error, (err: Error, extra) =>
    ({ message: err.message, ...extra ?? {}, stack: err.stack }));

  // Setup stack traces
  Error.stackTraceLimit = 50; // Deep limit
  install(); // Register source maps

  // Register shutdown handler
  ShutdownManager.register();

  // Initialize
  await ConsoleManager.register();
}

export async function runMain(action: Function, args: unknown[] = process.argv.slice(2)): Promise<void> {
  await setup();

  let res: unknown | undefined;
  let exitCode = 0;

  try {
    res = await action(...args);
  } catch (err) {
    res = err;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    exitCode = (res instanceof Error) ? (res as { code?: number })['code'] ?? 1 : 1;
  }

  ExecUtil.execResponse(exitCode, res);
}

export const runIfMain = async (target: Function, filename: string, mainFile: string): Promise<unknown> =>
  (path.forSrc(filename) === path.forSrc(process.env.TRV_MAIN || mainFile)) ? runMain(target) : undefined;