/// <reference path="../src/global-typings.d.ts" />

import { dirname } from 'path';
import type { LogLevel } from '../src/console';

const src = (file: string): string => file.replaceAll('\\', '/').replace(/[.]js$/, '.ts');

if (global.ᚕtrv) {
  console.error(`@travetto/boot was already loaded at ${global.ᚕtrv.self} but now is trying to be loaded in ${src(__filename)}`);
  console.error('This means you have two versions of the framework installed, which is not supported');
  process.exit(1);
}

type ObjProp = Parameters<(typeof Object)['defineProperty']>[2];

function prop(cfg: Function | string | Partial<ObjProp>, writable = false): ObjProp {
  if (typeof cfg === 'string' || typeof cfg === 'function') {
    cfg = { value: cfg };
  }
  return { configurable: writable, writable, enumerable: false, ...cfg };
}

// Remove to prevent __proto__ pollution in JSON
const objectProto = Object.prototype.__proto__;
Object.defineProperty(Object.prototype, '__proto__', prop({ get: () => objectProto }));

// Enable maps to be serialized as json
Object.defineProperty(Map.prototype, 'toJSON',
  prop(function (this: Map<unknown, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.entries()) {
      out[typeof k === 'string' ? k : `${k}`] = v;
    }
    return out;
  })
);

// Enable sets to be serialized as JSON
Object.defineProperty(Set.prototype, 'toJSON',
  prop(function (this: Set<unknown>) {
    return [...this.values()];
  })
);

// Add .toJSON to the default Error as well
Object.defineProperty(Error.prototype, 'toJSON', prop(
  function (this: Error, extra?: Record<string, unknown>) {
    return {
      message: this.message,
      ...extra,
      stack: this.resolveStack?.() ?? this.stack
    };
  }
));

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

const source = (file: string, _: undefined, ts = src(file)) => ({ file: ts, folder: dirname(ts) });

const utils = Object.defineProperties({}, {
  self: prop(src(__filename)),
  source: prop(source),
  main: prop(main),
  log: prop(log, true),
});

Object.defineProperty(global, 'ᚕtrv', prop(utils));