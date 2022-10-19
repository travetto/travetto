/// <reference path="../src/internal/global-typings.d.ts" />

if (global.ᚕtrv) {
  console.error(`@travetto/boot was already loaded at ${global.ᚕtrv} but now is trying to be loaded in ${__filename}`);
  console.error('This means you have two versions of the framework installed, which is not supported');
  process.exit(1);
}

// Remove to prevent __proto__ pollution in JSON
const objectProto = Object.prototype.__proto__;
Object.defineProperty(Object.prototype, '__proto__', { configurable: false, enumerable: false, get: () => objectProto });

function addFn(proto: object, name: string, fn: Function): void {
  Object.defineProperty(proto, name, { configurable: true, writable: false, enumerable: false, value: fn });
}

// Enable maps to be serialized as json
addFn(Map.prototype, 'toJSON', function (this: Map<unknown, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of this.entries()) {
    out[typeof k === 'string' ? k : `${k}`] = v;
  }
  return out;
});

// Enable sets to be serialized as JSON
addFn(Set.prototype, 'toJSON', function (this: Set<unknown>) {
  return [...this.values()];
});

// Add .toJSON to the default Error as well
addFn(Error.prototype, 'toJSON', function (this: Error, extra?: Record<string, unknown>) {
  return {
    message: this.message,
    ...extra,
    stack: this.resolveStack?.() ?? this.stack
  };
});

// Mark framework load location
global.ᚕtrv = __filename;

// Global default log interceptor
// eslint-disable-next-line no-console
global.ᚕlog = (level, ctx, ...args): void => console[level](...args);

// Declare main function invoker
global.ᚕmain = async (target, args = process.argv.slice(2), respond = true): Promise<ReturnType<typeof target>> => {
  const sourceMapSupport = await import('source-map-support');

  // Increase stack limit
  Error.stackTraceLimit = 50;

  // Register source maps
  sourceMapSupport.install();

  const path = await import('path');
  try { await import(path.resolve('.env')); } catch { } // Read env
  const res = await target(...args);
  if (respond) {
    const { parentPort } = await import('worker_threads');
    parentPort ? parentPort.postMessage(res) : console.log(JSON.stringify(res));
  }
  return res;
};