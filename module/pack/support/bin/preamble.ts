import { readFileSync as readSyncPreamble } from 'node:fs';

// @ts-expect-error -- Lock to prevent __proto__ pollution in JSON
const objectProto = Object.prototype.__proto__;
Object.defineProperty(Object.prototype, '__proto__', {
  get() { return objectProto; },
  set(val) { Object.setPrototypeOf(this, val); }
});

if (!process.env.TRV_MODULE && '%%ENV_FILE%%') {
  try {
    readSyncPreamble('%%ENV_FILE%%', 'utf8')
      .split('\n')
      .map(x => x.match(/\s*(?<key>[^ =]+)\s*=\s*(?<value>\S+)/)?.groups)
      .filter(x => !!x)
      .forEach(x => process.env[x.key] = x.value);
  } catch { }
}