import * as parser from '@typescript-eslint/parser';

import { RuntimeManifest } from '@travetto/manifest';

export const RULE_COMMON = {
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: RuntimeManifest.moduleType,
    globals: {
      AbortController: false,
      AbortSignal: false,
      AggregateError: false,
      Array: false,
      ArrayBuffer: false,
      Atomics: false,
      BigInt: false,
      BigInt64Array: false,
      BigUint64Array: false,
      Boolean: false,
      Buffer: false,
      clearImmediate: false,
      clearInterval: false,
      clearTimeout: false,
      console: false,
      DataView: false,
      Date: false,
      decodeURI: false,
      decodeURIComponent: false,
      DOMException: false,
      encodeURI: false,
      encodeURIComponent: false,
      Error: false,
      EvalError: false,
      Event: false,
      EventTarget: false,
      fetch: false,
      FinalizationRegistry: false,
      Float32Array: false,
      Float64Array: false,
      FormData: false,
      Function: false,
      global: false,
      globalThis: false,
      Headers: false,
      Infinity: false,
      Int16Array: false,
      Int32Array: false,
      Int8Array: false,
      Intl: false,
      isFinite: false,
      isNaN: false,
      JSON: false,
      Map: false,
      Math: false,
      MessageChannel: false,
      MessageEvent: false,
      MessagePort: false,
      NaN: false,
      Number: false,
      Object: false,
      parseFloat: false,
      parseInt: false,
      performance: false,
      process: false,
      Promise: false,
      propertyIsEnumerable: false,
      Proxy: false,
      queueMicrotask: false,
      RangeError: false,
      ReferenceError: false,
      Reflect: false,
      RegExp: false,
      Request: false,
      require: false,
      Response: false,
      Set: false,
      setImmediate: false,
      setInterval: false,
      setTimeout: false,
      SharedArrayBuffer: false,
      String: false,
      structuredClone: false,
      Symbol: false,
      SyntaxError: false,
      TextDecoder: false,
      TextEncoder: false,
      TypeError: false,
      Uint16Array: false,
      Uint32Array: false,
      Uint8Array: false,
      Uint8ClampedArray: false,
      undefined: false,
      unescape: false,
      URIError: false,
      WeakMap: false,
      WeakRef: false,
      WeakSet: false,
    },
    parser,
    parserOptions: {
      project: 'tsconfig.json'
    },
  },
};

export const IGNORES = [
  'node_modules/**/*',
  'dist/**/*',
  'out/**/*',
  '**/*.d.ts',
  '**/fixtures/**/*',
  '**/resources/**/*'
];