import { Temporal } from 'temporal-polyfill-lite';

Object.defineProperty(Map.prototype, 'getOrInsert', {
  value(key: unknown, value: unknown) {
    return this.getOrInsertComputed(key, () => value);
  },
  configurable: true
});

Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
  value(key: unknown, compute: () => unknown) {
    if (!this.has(key)) {
      this.set(key, compute());
    }
    return this.get(key);
  },
  configurable: true
});

Object.defineProperty(globalThis, 'Temporal', {
  value: Temporal,
  configurable: true
});