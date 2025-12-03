import { readFileSync as readSyncPreamble } from 'node:fs';

// @ts-expect-error -- Lock to prevent __proto__ pollution in JSON
const objectProto = Object.prototype.__proto__;
Object.defineProperty(Object.prototype, '__proto__', {
  get() { return objectProto; },
  set(value) { Object.setPrototypeOf(this, value); }
});

if (!process.env.TRV_MODULE && '%%ENV_FILE%%') {
  try {
    readSyncPreamble('%%ENV_FILE%%', 'utf8')
      .split('\n')
      .map(line => line.match(/\s*(?<key>[^ =]+)\s*=\s*(?<value>\S+)/)?.groups)
      .filter(pair => !!pair)
      .forEach(pair => process.env[pair.key] = pair.value);
  } catch { }
}