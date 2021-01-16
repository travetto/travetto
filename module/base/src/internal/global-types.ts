import { StacktraceUtil } from '../stacktrace';

type Primitive = number | boolean | string | Date | undefined | null | string[] | number[] | Error;
export declare type MessageContext = Record<string, Primitive | Record<string, Primitive>>;

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