import * as path from 'path';

import { ResourceManager, Util, Env } from '@travetto/base';
import { YamlUtil } from '@travetto/yaml';

type Prim = number | string | boolean | null;
export type Nested = { [key: string]: Prim | Nested | Nested[] };

export class ConfigUtil {

  static fetchOrderedConfigs() {
    const envFiles = ResourceManager.findAllByExtensionSync('.yml')
      .map(file => ({ file, profile: path.basename(file).replace('.yml', '') }))
      .sort((a, b) => {
        const ap = a.profile, bp = b.profile;
        return ((ap === 'application' ? 1 : 0) + (bp === 'application' ? -1 : 0)) ||
          ((ap === Env.env ? -1 : 0) + (bp === Env.env ? 1 : 0)) ||
          (ap.localeCompare(bp) || a.file.localeCompare(b.file));
      });

    return envFiles;
  }

  static getConfigFileAsData(file: string, ns: string = '') {
    const data = ResourceManager.readSync(file, 'utf8');
    const doc = YamlUtil.parse(data);
    return ns ? { [ns]: doc } : doc;
  }

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
        data[top] = data[top] ?? {};
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

    if (Array.isArray(val)) {
      return `${a}`.split(',').map(x => x.trim()).map(x => this.coerce(x, val[0]));
    }

    return Util.coerceType(a, val.constructor, false);
  }

  static getKeyName(key: string, data: Record<string, any>) {
    key = key.trim();
    const match = new RegExp(key, 'i');
    const next = Object.keys(data).find(x => match.test(x));
    return next;
  }

  static bindEnvByKey(obj: Nested, key?: string) {
    // Handle process.env on bind as the structure we need may not
    // fully exist until the config has been created
    const matcher = !key ? /./ : new RegExp(`^${key.replace(/[.]/g, '_')}`, 'i'); // Check is case insensitive
    for (const k of Object.keys(process.env)) { // Find all keys that match
      if (k.includes('_') && (!key || matcher.test(k))) { // Require at least one level
        ConfigUtil.bindEnvByParts(obj, key ? k.substring(key.length + 1).split('_') : k.split('_'), process.env[k] as string);
      }
    }
  }

  static bindEnvByParts(data: Nested, parts: string[], value: Prim) {
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

    key = this.getKeyName(key, data) || (/^[A-Z_0-9]+$/.test(key) ? key.toLowerCase() : key);
    data[key] = this.coerce(value, data[key]);

    return true;
  }
}