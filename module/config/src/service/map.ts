import { deepMerge, isPlainObject, isSimple } from '@travetto/base';

type Prim = number | string | boolean | null;

type Nested = { [key: string]: Prim | Nested | Nested[] };

function coerce(a: any, val: any): any {
  if (a === 'null' && typeof val !== 'string') {
    return null;
  }

  if (val === null || val === undefined) {
    return a;
  }

  if (isSimple(val)) {
    switch (typeof val) {
      case 'string': return `${a}`;
      case 'number': return `${a}`.indexOf('.') >= 0 ? parseFloat(`${a}`) : parseInt(`${a}`, 10);
      case 'boolean': return (typeof a === 'string' && a === 'true') || !!a;
      default:
        throw new Error(`Unknown type ${typeof val}`);
    }
  }

  if (Array.isArray(val)) {
    return `${a}`.split(',').map(x => x.trim()).map(x => coerce(x, val[0]));
  }
}

export class ConfigMap {

  // Lowered, and flattened
  private storage: Nested = {};

  putAll(data: Nested) {
    deepMerge(this.storage, data, 'coerce');
  }

  putAllFlattened(data: { [key: string]: Prim }) {
    for (const path of Object.keys(data)) {
      this.putFlattened(path, data[path]);
    }
  }

  putFlattened(path: string, value: Prim) {
    const parts = path.split('_');
    const key = parts.pop()!;
    let data = this.storage;

    while (parts.length) {
      const part = parts.shift()!;
      const match = new RegExp(part, 'i');
      const next = Object.keys(data).find(x => match.test(x));
      if (!next) {
        return false;
      } else {
        data = data[next] as Nested;
      }
    }

    if (!data) {
      return false;
    }

    data[key] = coerce(value, data[key]);

    return true;
  }

  bindTo(obj: any, key: string) {
    const keys = key.split('.');
    let sub: any = this.storage;
    while (keys.length && sub[keys[0]]) {
      sub = sub[keys.shift()!];
    }
    deepMerge(obj, sub);
    return obj;
  }

  get(key: string) {
    return this.bindTo({}, key);
  }

  toJSON() {
    return JSON.stringify(this.storage, null, 2);
  }
}