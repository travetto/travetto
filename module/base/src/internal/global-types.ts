import { Env } from '../env';
import { StacktraceUtil } from '../stacktrace';
import { Console } from 'console';

// Enable maps to be serialized as json
Map.prototype.toJSON = function (this: Map<any, any>) {
  const out = {} as Record<string, any>;
  for (const [k, v] of this.entries()) {
    out[k] = v;
  }
  return out;
};

// Enable sets to be serialized as JSON
Set.prototype.toJSON = function (this: Set<any>) {
  return [...this.values()];
};

// Add .toConsole to the default Error as well
Error.prototype.toConsole = function (mid: any = '') {
  const stack = (Env.prod || Env.trace) ? this.stack! : StacktraceUtil.simplifyStack(this);
  return `${this.message}\n${mid}${stack.substring(stack.indexOf('\n') + 1)}`;
};

// Add .fatal to the console prototype
Console.prototype.fatal = function (msg: string, ...args: any[]) {
  return this.error(msg, ...args);
};