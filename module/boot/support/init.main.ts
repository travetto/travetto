import * as sourceMapSupport from 'source-map-support';
import { parentPort } from 'worker_threads';

import { path } from '@travetto/manifest';

import { trv } from './init.helper';

async function runMain(action: Function, args: unknown[]): Promise<void> {
  let res: unknown | undefined;
  let exitCode = 0;

  try {
    res = await action(...args);
  } catch (err) {
    res = err;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    exitCode = (res instanceof Error) ? (res as { code?: number })['code'] ?? 1 : 1;
  }

  if (parentPort) {
    parentPort.postMessage(res);
  } else if (res) {
    process.stdout.write(`${JSON.stringify(res)}\n`);
  }

  process.exit(exitCode);
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setToJSON = <T>(cons: abstract new (...args: any[]) => T, handler: (val: T, ...args: any[]) => unknown): void => {
  Object.defineProperty(cons.prototype, 'toJSON', {
    writable: false,
    // eslint-disable-next-line object-shorthand, @typescript-eslint/no-explicit-any
    value: function (this: T, ...args: any[]) { return handler(this, ...args); }
  });
};

async function setupLogging(): Promise<void> {
  const { ConsoleManager } = await import('../src/console');

  // Declare log target
  trv.log = ConsoleManager.invoke.bind(ConsoleManager);

  // Attempt to setup logger
  try {
    const { Logger } = await import('@travetto/log');
    ConsoleManager.set(Logger, true); // Make default
  } catch { }

  // Set debug state
  ConsoleManager.setDebug(process.env.TRV_DEBUG ?? false);
}

// Setup everything
async function setup(): Promise<void> {
  // Read .env setup
  try { await import(path.resolve('.env')); } catch { }

  // Delete if set
  delete process.env.TRV_MAIN;

  // Remove to prevent __proto__ pollution in JSON
  const objectProto = Object.prototype.__proto__;
  Object.defineProperty(Object.prototype, '__proto__', { writable: false, value: objectProto });

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
  sourceMapSupport.install(); // Register source maps

  // Register shutdown handler
  const { ShutdownManager } = await import('../src/shutdown');
  ShutdownManager.register();

  await setupLogging();
}

export async function runIfMain(target: Function, filename: string, module: NodeJS.Module): Promise<unknown> {
  if (filename === path.toPosix(process.env.TRV_MAIN ?? '') || (!process.env.TRV_MAIN && module === require.main)) {
    await setup();
    return runMain(target, process.argv.slice(2));
  }
}