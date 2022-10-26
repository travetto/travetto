/// <reference path="../src/global-typings.d.ts" />

import { dirname } from 'path';
import type { LogLevel } from '../src/console';

const src = (file: string): string => file.replaceAll('\\', '/').replace(/[.]js$/, '.ts');

if (global.ᚕtrv) {
  console.error(`@travetto/boot was already loaded at ${global.ᚕtrv.self} but now is trying to be loaded in ${src(__filename)}`);
  console.error('This means you have two versions of the framework installed, which is not supported');
  process.exit(1);
}

const propDef = { writable: false };

// Remove to prevent __proto__ pollution in JSON
const objectProto = Object.prototype.__proto__;
Object.defineProperty(Object.prototype, '__proto__', { ...propDef, value: objectProto });

// Enable maps to be serialized as json
Object.defineProperty(Map.prototype, 'toJSON', {
  ...propDef,
  value: function (this: Map<unknown, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.entries()) {
      out[typeof k === 'string' ? k : `${k}`] = v;
    }
    return out;
  }
});

// Enable sets to be serialized as JSON
Object.defineProperty(Set.prototype, 'toJSON', {
  ...propDef,
  value: function (this: Set<unknown>) {
    return [...this.values()];
  }
});

// Add .toJSON to the default Error as well
Object.defineProperty(Error.prototype, 'toJSON', {
  ...propDef,
  value: function (this: Error, extra?: Record<string, unknown>) {
    return {
      message: this.message,
      ...extra,
      stack: this.resolveStack?.() ?? this.stack
    };
  }
});

// Add __posix to the String class
Object.defineProperty(String.prototype, '__unix', {
  ...propDef,
  get() {
    return this.replaceAll('\\', '/');
  }
})

async function main(target: Function, args = process.argv.slice(2), respond = true): Promise<unknown> {
  const sourceMapSupport = await import('source-map-support');

  // Increase stack limit
  Error.stackTraceLimit = 50;

  // Register source maps
  sourceMapSupport.install();

  const send = respond ? async function send(res: unknown): Promise<void> {
    const { parentPort } = await import('worker_threads');
    parentPort ? parentPort.postMessage(res) : console.log(JSON.stringify(res));
  } : (): void => { };

  const path = await import('path');
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

const source = (file: string) => ({ file: src(file), folder: dirname(src(file)) });

const utils = Object.defineProperties({}, {
  self: { ...propDef, value: src(__filename) },
  source: { ...propDef, value: source },
  main: { ...propDef, value: main },
  log: { writable: true, value: log },
});

Object.defineProperty(global, 'ᚕtrv', { ...propDef, value: utils });