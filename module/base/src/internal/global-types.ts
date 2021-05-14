import { StacktraceUtil } from '../stacktrace';

declare global {
  interface Error { toJSON(sub?: unknown): unknown }
  interface Map<K, V> { toJSON(): unknown }
  interface Set<T> { toJSON(): unknown }
  interface AsyncGenerator<T> { toArray(): Promise<T[]> }
}

export type Primitive = number | boolean | string | Date | Error;

// Enable maps to be serialized as json
Map.prototype.toJSON = function (this: Map<unknown, unknown>) {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of this.entries()) {
    out[typeof k === 'string' ? k : `${k}`] = v;
  }
  return out;
};

// Enable sets to be serialized as JSON
Set.prototype.toJSON = function (this: Set<unknown>) {
  return [...this.values()];
};

// Add .toJSON to the default Error as well
Error.prototype.toJSON = function (extra?: Record<string, unknown>) {
  const stack = StacktraceUtil.simplifyStack(this);
  return {
    message: this.message,
    ...extra,
    stack: stack.substring(stack.indexOf('\n') + 1)
  };
};

const proto = Object.getPrototypeOf(Object.getPrototypeOf((async function* () { })()));
Object.defineProperty(proto, 'toArray', {
  configurable: false,
  writable: false,
  enumerable: false,
  async value() {
    const out = [];
    for await (const item of this) {
      out.push(item);
    }
    return out;
  }
});