import * as sourceMapSupport from 'source-map-support';
import { parentPort } from 'worker_threads';

import * as path from '@travetto/path';

import type { LogLevel } from '../src/types';

const src = (file: string): string => path.toPosix(file).replace(/[.]js$/, '.ts');

if (global.ᚕtrv) {
  console.error(`@travetto/boot was already loaded at ${global.ᚕtrv.self} but now is trying to be loaded in ${src(__filename)}`);
  console.error('This means you have two versions of the framework installed, which is not supported');
  process.exit(1);
}

// Remove to prevent __proto__ pollution in JSON
const objectProto = Object.prototype.__proto__;
Object.defineProperty(Object.prototype, '__proto__', { writable: false, value: objectProto });

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
      stack: ᚕtrv.resolveStack?.(this) ?? this.stack
    };
  }
});

async function main(target: Function, args = process.argv.slice(2), respond = true): Promise<unknown> {
  // Increase stack limit
  Error.stackTraceLimit = 50;

  // Register source maps
  sourceMapSupport.install();

  const send = respond ? async function send(res: unknown): Promise<void> {
    parentPort ? parentPort.postMessage(res) : console.log(JSON.stringify(res));
  } : (): void => { };

  try { await import(path.resolve('.env')); } catch { } // Read env
  try {
    const res = await target(...args);
    await send(res);
    return res;
  } catch (err) {
    await send(err);
    throw err;
  }
}

// Global default log interceptor
// eslint-disable-next-line no-console
const log = (level: LogLevel, ctx: unknown, ...args: unknown[]): void => console[level](...args);

const output = (file: string): string => path.toPosix(file);

const utils = Object.defineProperties({}, {
  self: { writable: false, value: src(__filename) },
  output: { writable: false, value: output },
  main: { writable: false, value: main },
  log: { writable: true, value: log },
  resolveStack: { writable: true, value: undefined }
});

Object.defineProperty(global, 'ᚕtrv', { writable: false, value: utils });