import * as sourceMapSupport from 'source-map-support';
import * as path from 'path';

let stackResolver: ((error: Error) => string) | undefined;

declare global {
  // eslint-disable-next-line no-var
  var ᚕtrvSelf: string | undefined;
  // eslint-disable-next-line no-var
  var ᚕtrvFinalized: boolean;
}

function assertInstallation(): void {
  if (global.ᚕtrvSelf) {
    console.error(`@travetto/boot was already loaded at ${global.ᚕtrvSelf} but now is trying to be loaded in ${__filename}`);
    console.error('This means you have two versions of the framework installed, which is not supported');
    process.exit(1);
  } else {
    global.ᚕtrvSelf = __filename;
  }
}

function registerJsonEnhancements(): void {
  // Enable maps to be serialized as json
  Object.defineProperty(Map.prototype, 'toJSON', {
    writable: false,
    value(this: Map<unknown, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [k, v] of this.entries()) {
        out[typeof k === 'string' ? k : `${k}`] = v;
      }
      return out;
    }
  });

  // Enable sets to be serialized as JSON
  Object.defineProperty(Set.prototype, 'toJSON', {
    writable: false,
    value(this: Set<unknown>): unknown[] {
      return [...this.values()];
    }
  });

  // Add .toJSON to the default Error as well
  Object.defineProperty(Error.prototype, 'toJSON', {
    writable: false,
    value(this: Error, extra?: Record<string, unknown>): Record<string, unknown> {
      return {
        message: this.message,
        ...extra,
        stack: stackResolver?.(this) ?? this.stack
      };
    }
  });
}

function secureObjectPrototype(): void {
  // Remove to prevent __proto__ pollution in JSON
  const objectProto = Object.prototype.__proto__;
  Object.defineProperty(Object.prototype, '__proto__', { writable: false, value: objectProto });
}

function registerOutputHelper(): void {
  const output = (file: string): string => file.replaceAll('\\', '/');
  Object.defineProperty(global, 'ᚕtrvOut', { writable: false, value: output });
}
function registerInitialLogging(): void {
  // eslint-disable-next-line no-console
  globalThis.ᚕtrvLog = (level, ctx, ...args): void => console[level](...args);
}

function init(): void {
  assertInstallation();
  secureObjectPrototype();
  registerJsonEnhancements();
  registerOutputHelper();
  registerInitialLogging();
}

export async function finalize(): Promise<void> {
  if (globalThis.ᚕtrvFinalized) {
    return;
  }
  globalThis.ᚕtrvFinalized = true;
  // Read .env setup
  try { await import(path.resolve('.env')); } catch { }

  const { ConsoleManager } = await import('../src/console');

  // Register global logging
  globalThis.ᚕtrvLog = ConsoleManager.invoke.bind(ConsoleManager);

  const { StacktraceManager } = await import('../src/stacktrace');

  // Setup error handling
  Error.stackTraceLimit = 50; // Deep limit
  sourceMapSupport.install(); // Register source maps

  // Attach stack resolver
  stackResolver = (err: Error): string => {
    const stack = StacktraceManager.simplifyStack(err);
    return stack.substring(stack.indexOf('\n') + 1);
  };
}

/**
 * Generic main entry point for running code
 *
 * @param target
 * @param args
 * @param respond
 * @returns
 */
export async function invokeMain(target: Function, args = process.argv.slice(2), respond = true): Promise<unknown> {
  const { parentPort } = await import('worker_threads');

  // Ensure we are finalized before starting
  await finalize();

  const send = respond ? async function send(res: unknown): Promise<void> {
    parentPort ? parentPort.postMessage(res) : (res ? console.log(JSON.stringify(res)) : undefined);
  } : (): void => { };
  try {
    const res = await target(...args);
    await send(await res);
    return res;
  } catch (err) {
    await send(err);
    throw err;
  }
}

init();