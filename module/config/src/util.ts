import { readFileSync } from 'fs';
import * as path from 'path';

import { Env, ScanApp, ResourceManager, Util } from '@travetto/base';
import { YamlUtil } from '@travetto/yaml';

type Prim = number | string | boolean | null;
export type Nested = { [key: string]: Prim | Nested | Nested[] };

export class ConfigUtil {

  static getActiveProfileFiles() {
    const envFiles = ResourceManager.findAllByExtensionSync('.yml')
      .map(file => ({ file, profile: path.basename(file).replace('.yml', '') }))
      .filter(({ profile }) => Env.hasProfile(profile))
      .map(({ file, profile }) => {
        const finalPath = ResourceManager.getAbsolutePathSync(file);
        return { file: finalPath, profile };
      });

    return envFiles;
  }

  static getAllConfigFilesAsData() {
    // Load all namespaces from core
    return ScanApp.findFiles('.yml', x => /config\/[^/]+.yml$/.test(x))
      .map(({ file }) => {
        const ns = path.basename(file).replace('.yml', '');
        return this.getConfigFileAsData(file, ns);
      });
  }

  static getConfigFileAsData(file: string, ns: string = '') {
    const data = readFileSync(file, 'utf-8');
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
      return Util.coerceType(a, val.constructor, false);
    } else if (Array.isArray(val)) {
      return `${a}`.split(',').map(x => x.trim()).map(x => this.coerce(x, val[0]));
    }
  }

  static getKeyName(key: string, data: { [key: string]: any }) {
    key = key.trim();
    const match = new RegExp(key, 'i');
    const next = Object.keys(data).find(x => match.test(x));
    return next;
  }

  static bindEnvByKey(obj: Nested, key: string) {
    // Handle process.env on bind as the structure we need may not
    // fully exist until the config has been created
    const matcher = new RegExp(`^${key.replace(/[.]/g, '_')}`, 'i'); // Check is case insensitive
    for (const k of Object.keys(process.env)) { // Find all keys that match
      if (k.includes('_') && matcher.test(k)) { // Require at least one level
        ConfigUtil.bindEnvByParts(obj, k.substring(key.length + 1).split('_'), process.env[k] as string);
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