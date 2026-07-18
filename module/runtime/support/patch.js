import fs from 'node:fs/promises';

if (process.env.NODE_ENV !== 'production') {
  process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps`; // Ensure it passes to children
  Error.stackTraceLimit = 50;
}

// polyfills
if (!globalThis.Temporal) {
  // For anyone that doesn't have it
  void import('temporal-polyfill-lite/global');
}

Map.prototype.getOrInsert ??= function (key, value) {
  if (!this.has(key)) {
    this.set(key, value);
  }
  return this.get(key);
};

Map.prototype.getOrInsertComputed ??= function (key, compute) {
  if (!this.has(key)) {
    this.set(key, compute());
  }
  return this.get(key);
};

// Allow for the throwIfNoEntry if on a version of node that is less than 25.7
const [majorVersion, minorVersion] = process.version.match(/\d+/g).map(text => parseInt(text, 10));
if (majorVersion < 25 || (majorVersion === 25 && minorVersion < 7)) {
  const og = fs.stat;
  Object.defineProperty(fs, 'stat', {
    value: (...args) => {
      const out = og.call(fs, ...args);
      if (typeof args[1] === 'object' && args[1].throwIfNoEntry === false) {
        return out.catch(() => {});
      }
      return out;
    }
  });
}
