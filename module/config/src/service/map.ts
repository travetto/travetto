import { Util } from '@travetto/base';

type Prim = number | string | boolean | null;

type Nested = { [key: string]: Prim | Nested | Nested[] };

const ENV_SEP = '_';

export class ConfigMap {

  static breakDownKeys(data: Nested) {
    for (const key of Object.keys(data)) {
      if (Util.isPlainObject(data[key])) {
        this.breakDownKeys(data[key] as Nested);
      }
      if (key.includes('.')) {
        const parts = key.split('.');
        const top = parts[0];
        const subTop = {};
        let sub: any = subTop;

        while (parts.length > 1) {
          sub = (sub[parts.shift()!] = {});
        }
        sub[parts[0]] = data[key];
        data[top] = data[top] || {};
        delete data[key];
        Util.deepAssign(data, subTop);
      }
    }
    return data;
  }

  static coerce(a: any, val: any): any {
    if (a === 'null' && typeof val !== 'string') {
      return null;
    }

    if (val === null || val === undefined) {
      return a;
    }

    if (Util.isSimple(val)) {
      switch (typeof val) {
        case 'string': return `${a}`;
        case 'number': return `${a}`.indexOf('.') >= 0 ? parseFloat(`${a}`) : parseInt(`${a}`, 10);
        case 'boolean': return (typeof a === 'string' && a === 'true') || !!a;
        default:
          throw new Error(`Unknown type ${typeof val}`);
      }
    }

    if (Array.isArray(val)) {
      return `${a}`.split(',').map(x => x.trim()).map(x => this.coerce(x, val[0]));
    }
  }

  static getKeyName(key: string, data: { [key: string]: any }) {
    key = key.trim();
    const match = new RegExp(key, 'i');
    const next = Object.keys(data).find(x => match.test(x));
    return next;
  }

  static putCaseInsensitivePath(data: Nested, parts: string[], value: Prim) {
    parts = parts.slice(0);

    let key = parts.pop()!;

    if (!key) {
      return false;
    }

    while (parts.length) {
      const part = parts.shift()!;
      const next = this.getKeyName(part, data);
      if (!next) {
        return false;
      } else {
        data = data[next] as Nested;
      }
    }

    if (!data) {
      return false;
    }

    key = this.getKeyName(key, data) || key;
    data[key] = ConfigMap.coerce(value, data[key]);

    return true;
  }

  // Lowered, and flattened
  private storage: Nested = {};

  reset() {
    this.storage = {};
  }

  putAll(data: Nested) {
    Util.deepAssign(this.storage, ConfigMap.breakDownKeys(data), 'coerce');
  }

  bindTo(obj: any, key: string) {
    const keys = key ? key.split('.') : [];
    let sub: any = this.storage;

    while (keys.length && sub) {
      const next = keys.shift()!;
      sub = sub[next];
    }

    if (sub) {
      Util.deepAssign(obj, sub);
    }

    // Handle process.env on bind as the structure we need may not
    // fully exist until the config has been created
    const matcher = new RegExp(`^${key.replace(/[.]/g, '_')}`, 'i');
    for (const k of Object.keys(process.env)) {
      if (k.includes(ENV_SEP) && matcher.test(k)) { // Require at least one level
        ConfigMap.putCaseInsensitivePath(obj, k.substring(key.length + 1).split(ENV_SEP), process.env[k] as string);
      }
    }

    return obj;
  }

  get(key: string) {
    return this.bindTo({}, key);
  }

  toJSON() {
    return JSON.stringify(this.storage, null, 2);
  }
}