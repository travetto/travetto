import * as sourceMapSupport from 'source-map-support';
import { parentPort } from 'worker_threads';

import { path } from '@travetto/manifest';

function send(err?: unknown, res?: unknown): void {
  if (parentPort) {
    parentPort.postMessage(err ?? res);
  } else if (res) {
    process.stdout.write(`${JSON.stringify(err ?? res)}\n`);
  }
}

type Responder = typeof send;

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
}

function secureObjectPrototype(): void {
  // Remove to prevent __proto__ pollution in JSON
  const objectProto = Object.prototype.__proto__;
  Object.defineProperty(Object.prototype, '__proto__', { writable: false, value: objectProto });
}

// Register global logging
async function setupLogging() {
  const { ConsoleManager } = await import('../src/console');

  // Attempt to setup logger
  try {
    const { Logger } = await import('@travetto/log');
    ConsoleManager.set(Logger, true); // Make default
  } catch { }

  // Set debug state
  ConsoleManager.setDebug(process.env.TRV_DEBUG ?? false);
}

// Setup error handling
async function setupErrorHandling() {
  const { StacktraceManager } = await import('../src/stacktrace');

  Error.stackTraceLimit = 50; // Deep limit
  sourceMapSupport.install(); // Register source maps

  // Attach stack resolver
  const stackResolver = (err: Error): string => {
    const stack = StacktraceManager.simplifyStack(err);
    return stack.substring(stack.indexOf('\n') + 1);
  };

  // Add .toJSON to the default Error as well
  Object.defineProperty(Error.prototype, 'toJSON', {
    writable: false,
    value(this: Error, extra?: Record<string, unknown>): Record<string, unknown> {
      return {
        message: this.message,
        ...extra,
        stack: stackResolver(this) ?? this.stack
      };
    }
  });
}

// Register shutdown handler
async function setupShutdownSupport() {
  const { ShutdownManager } = await import('../src/shutdown');
  ShutdownManager.register();
}

/**
 * Generic main entry point for running code
 */
export async function invokeMain(target: Function, args = process.argv.slice(2), respond: Responder = send): Promise<void> {
  // Read .env setup
  try { await import(path.resolve('.env')); } catch { }

  secureObjectPrototype();
  registerJsonEnhancements();

  await setupLogging();
  await setupErrorHandling();
  await setupShutdownSupport();

  try {
    const res = await target(...args);
    respond(undefined, await res);
    process.exit(0);
  } catch (err) {
    respond(err, undefined);
    if (err instanceof Error) {
      process.exit((err as { code?: number })['code'] ?? 1);
    }
  }
}