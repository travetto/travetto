import * as sourceMapSupport from 'source-map-support';

import { EnvUtil } from '../env';
import { PathUtil } from '../path';
import { TranspileCache } from './transpile-cache';

declare global {
  // eslint-disable-next-line no-var
  var ts: unknown;

  interface Object {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __proto__: unknown;
  }

  function ᚕsrc(f: string): string;
  function ᚕlog(level: string, ...args: unknown[]): void;
}

const objectProto = Object.prototype.__proto__;

// Remove to prevent __proto__ pollution in JSON
Object.defineProperty(Object.prototype, '__proto__', { configurable: false, enumerable: false, get: () => objectProto });

// Registering unix conversion to use for filenames
global.ᚕsrc = PathUtil.toUnixSource;

// Global default log interceptor
global.ᚕlog = (level: string, ...args: unknown[]): string => (console as unknown as any)[level](...args);

// Inject into global space as 'ts'
global.ts = new Proxy({}, {
  // Load on demand, and replace on first use
  get: (t, prop, r): unknown => (global.ts = require('typescript'))[prop]
});

// Register source maps for cached files
sourceMapSupport.install({
  emptyCacheBetweenOperations: EnvUtil.isDynamic(),
  retrieveFile: p => TranspileCache.readOptionalEntry(PathUtil.toUnixSource(p))!
});
