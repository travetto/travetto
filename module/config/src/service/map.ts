import { deepMerge, isPlainObject } from '@travetto/base';

type Nested = { [key: string]: string | number | boolean | null | Nested };

const NULL = Symbol('NULL');

export class ConfigMap {

  // Lowered, and flattened
  private storage: Nested = {};

  // Will store output when done
  private _finalized: Nested;

  putAll(data: Nested) {
    delete this._finalized;
    deepMerge(this.storage, data, 'coerce');
  }

  putAllFlattened(data: { [key: string]: number | string | boolean | null }) {
    const topLevel = new RegExp(`^(${Object.keys(this.storage).join('|')})`, 'i');
    const validPaths = Object.keys(data).filter(x => topLevel.test(x));

    for (const path of validPaths) {
      // Handle flattening
    }
  }

  private static dropNulls(o: any) {
    if (isPlainObject(o)) {
      for (const k of Object.keys(o)) {
        if (o[k] === NULL) {
          delete o[k];
        } else {
          this.dropNulls(o[k]);
        }
      }
    } else if (Array.isArray(o)) {
      o = o.map(this.dropNulls).filter((x: any) => x !== NULL);
    }
    return o;
  }

  private get finalized() {
    if (!this._finalized) {
      this._finalized = ConfigMap.dropNulls(this.storage);
    }
    return this._finalized;
  }

  bindTo(obj: any, key: string) {
    const keys = key.split('.');
    let sub: any = this.finalized;
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
    return JSON.stringify(this.finalized, null, 2);
  }
}