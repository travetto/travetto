import 'temporal-polyfill-lite/global';
import fs from 'node:fs/promises';

if (process.env.NODE_ENV !== 'production') {
  process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps`; // Ensure it passes to children
  Error.stackTraceLimit = 50;

  const ogEmitWarning = process.emitWarning;
  const exclusions = global.devProcessWarningExclusions = [];
  process.emitWarning = (message, category, ...other) => {
    if (exclusions.length === 0 || !exclusions.some(filter => filter(message, category))) {
      return ogEmitWarning(message, category, ...other);
    }
  };
}

const isError = Error.isError.bind(Error);
Object.defineProperty(Error, 'isError', {
  value: (input) => isError(input) || (input instanceof Error)
});

// polyfills

const [majorVersion, minorVersion] = process.version.replace(/^v/, '').split('.').map(text => parseInt(text, 10));

Map.prototype.getOrInsert ??= function (key, value) {
  return (this.has(key) || this.set(key, value), this.get(key));
};

Map.prototype.getOrInsertComputed ??= function (key, compute) {
  return (this.has(key) || this.set(key, compute()), this.get(key));
};

// Allow for the throwIfNoEntry if on a version of node that is less than 25.7
if (majorVersion < 25 || (majorVersion === 25 && minorVersion < 7)) {
  const og = fs.stat;
  Object.defineProperty(fs, 'stat', {
    value: (...args) => {
      const out = og.call(fs, ...args);
      if (typeof args[1] === 'object' && args[1].throwIfNoEntry === false) {
        return out.catch(() => { });
      }
      return out;
    }
  });
}