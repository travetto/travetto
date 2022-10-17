import * as sourceMapSupport from 'source-map-support';

const objectProto = Object.prototype.__proto__;

// Remove to prevent __proto__ pollution in JSON
Object.defineProperty(Object.prototype, '__proto__', { configurable: false, enumerable: false, get: () => objectProto });

// Global default log interceptor
// eslint-disable-next-line no-console
global.ᚕlog = (level, ctx, ...args): void => console[level](...args);

// Register source maps
sourceMapSupport.install();

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

global.ts = new Proxy({}, {
  // Load on demand, and replace on first use
  get: (t, prop, r): unknown => (global.ts = require('typescript'))[prop]
});

// Increase stack limit
Error.stackTraceLimit = 50;
