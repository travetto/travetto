import 'temporal-polyfill-lite/global';
import fs from 'node:fs/promises';

const [majorVersion, minorVersion] = process.version.replace(/^v/, '').split('.').map(text => parseInt(text, 10));

Map.prototype.getOrInsert ??= function (key, value) {
  return (this.has(key) || this.set(key, value), this.get(key));
};

Map.prototype.getOrInsertComputed ??= function (key, compute) {
  return (this.has(key) || this.set(key, compute()), this.get(key));
};

// Allow for the throwIfNoEntry if on a version of node that is less than 25.7
if (majorVersion < 25 || (majorVersion === 25 && minorVersion < 7)) {
  const og = fs.stat.bind(fs);
  Object.defineProperty(fs, 'stat', {
    value: (path, options) => {
      const out = og(path, options);
      if (options.throwIfNoEntry === false) {
        return out.catch(() => { });
      }
      return out;
    }
  });
}

const isError = Error.isError.bind(Error);
Object.defineProperty(Error, 'isError', {
  value: (input) => isError(input) || (input instanceof Error)
});