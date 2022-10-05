import * as sourceMapSupport from 'source-map-support';

declare global {
  interface Object {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __proto__: unknown;
  }

  function ᚕlog(level: 'error' | 'info' | 'warn' | 'debug' | 'log', ...args: unknown[]): void;
}

const objectProto = Object.prototype.__proto__;

// Remove to prevent __proto__ pollution in JSON
Object.defineProperty(Object.prototype, '__proto__', { configurable: false, enumerable: false, get: () => objectProto });

// Global default log interceptor
// eslint-disable-next-line no-console
global.ᚕlog = (level, ...args): void => console[level](...args);

// Register source maps
sourceMapSupport.install();