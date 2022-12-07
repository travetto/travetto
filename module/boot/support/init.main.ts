import { install } from 'source-map-support';
import url from 'url';
import { parentPort } from 'worker_threads';

import { path } from '@travetto/manifest';

import { trv } from './init.helper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setToJSON = <T>(cons: abstract new (...args: any[]) => T, handler: (val: T, ...args: any[]) => unknown): void => {
  Object.defineProperty(cons.prototype, 'toJSON', {
    writable: false,
    // eslint-disable-next-line object-shorthand, @typescript-eslint/no-explicit-any
    value: function (this: T, ...args: any[]) { return handler(this, ...args); }
  });
};

async function setupLogging(): Promise<void> {
  const { ConsoleManager } = await import('../src/console.js');

  // Declare log target
  trv.log = (await ConsoleManager.init()).invoke.bind(ConsoleManager);

  // Attempt to setup logger
  try {
    const { Logger } = await import('@travetto/log');
    ConsoleManager.set(Logger, true); // Make default
  } catch { }

  // Set debug state
  ConsoleManager.setDebugFromEnv();
}

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
  const { ShutdownManager } = await import('../src/shutdown.js');
  ShutdownManager.register();

  await setupLogging();
}

export function sendResponse(exitCode: number, message: unknown): void {
  if (parentPort) {
    parentPort.postMessage(message);
  } else if (process.send) {
    process.send(message);
  } else if (message) {
    process[exitCode === 0 ? 'stdout' : 'stderr'].write(`${JSON.stringify(message)}\n`);
  }
  process.exit(exitCode);
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

  sendResponse(exitCode, res);
}

export async function runIfMain(target: Function, filename: string, mainFile: string): Promise<unknown> {
  mainFile = process.env.TRV_MAIN || mainFile;
  if (mainFile.startsWith('file:')) {
    mainFile = url.fileURLToPath(mainFile);
  }
  if (filename === mainFile) {
    return await runMain(target);
  }
}