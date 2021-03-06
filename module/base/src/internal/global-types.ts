import { EnvUtil } from '@travetto/boot';
import { AppManifest } from '../manifest';
import { StacktraceUtil } from '../stacktrace';

declare global {
  interface Error { toJSON(sub?: unknown): unknown }
  interface Map<K, V> { toJSON(): unknown }
  interface Set<T> { toJSON(): unknown }
  interface AsyncGenerator<T> { toArray(): Promise<T[]> }
  interface AsyncIterable<T> { toArray(): Promise<T[]> }
}

export type Primitive = number | boolean | string | Date | Error;

function addFn(proto: object, name: string, fn: Function) {
  Object.defineProperty(proto, name, { configurable: true, writable: false, enumerable: false, value: fn });
}

// Enable maps to be serialized as json
addFn(Map.prototype, 'toJSON', function (this: Map<unknown, unknown>) {
  const out = {} as Record<string, unknown>;
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
  const stack = StacktraceUtil.simplifyStack(this);
  return {
    message: this.message,
    ...extra,
    stack: stack.substring(stack.indexOf('\n') + 1)
  };
});

// Add .toArray to async iterables
const AsyncProto = Object.getPrototypeOf(Object.getPrototypeOf((async function* () { })()));
addFn(AsyncProto, 'toArray', async function (this: AsyncGenerator<unknown>) {
  const out = [];
  for await (const item of this) {
    out.push(item);
  }
  return out;
});