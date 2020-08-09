import * as path from 'path';

import { ResourceManager, Util, AppManifest } from '@travetto/base';
import { YamlUtil } from '@travetto/yaml';

type Prim = number | string | boolean | null;
export type Nested = { [key: string]: Prim | Prim[] | Nested };

/**
 * Simple Config Utilities
 */
export class ConfigUtil {

  /**
   * Read ordered config files
   * - application.yml
   * - profiles.yml
   * - env.yml
   */
  static fetchOrderedConfigs() {
    const profileIndex = AppManifest.profiles.reduce((acc, k, v) => {
      acc[k] = v;
      return acc;
    }, {} as Record<string, number>);
    return ResourceManager.findAllByPatternSync(/[.]ya?ml$/)
      .map(file => ({ file, profile: path.basename(file).replace(/[.]ya?ml$/, '') }))
      .filter(({ profile }) => profile in profileIndex)
      .sort((a, b) => profileIndex[a.profile] - profileIndex[b.profile]);
  }

  /**
   * Parse config file from YAML into JSON
   */
  static getConfigFileAsData(file: string, ns: string = '') {
    const data = ResourceManager.readSync(file, 'utf8');
    const doc = YamlUtil.parse(data);
    return ns ? { [ns]: doc } : doc;
  }

  /**
   * Break down dotted keys into proper objects with nesting
   */
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

  /**
  * Break down dotted keys into proper objects with nesting
  */
  static toFullKeys(data: Nested, prefix: string = '') {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = `${prefix}${key}`;
      if (Util.isPlainObject(value)) {
        Object.assign(out,
          this.toFullKeys(value as Nested, `${pre}.`)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (Util.isPlainObject(value[i]) || Array.isArray(value[i])) {
            Object.assign(out, this.toFullKeys(value[i], `${pre}[${i}].`));
          } else {
            out[`${pre}[${i}]`] = value[i];
          }
        }
      } else {
        out[pre] = value;
      }
    }
    return out;
  }

  /**
   * Coerce the input type to match the existing field type
   */
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

  /**
   * Find the key using case insensitive search
   */
  static getKeyName(key: string, data: Record<string, any>) {
    key = key.trim();
    const match = new RegExp(key, 'i');
    const next = Object.keys(data).find(x => match.test(x));
    return next;
  }

  /**
   * Bind the environment variables onto an object structure when they match by name.
   * Will split on _ to handle nesting appropriately
   */
  static bindEnvByKey(obj: Nested, key?: string) {
    // Handle process.env on bind as the structure we need may not
    // fully exist until the config has been created
    const matcher = !key ? /./ : new RegExp(`^${key.replace(/[.]/g, '_')}`, 'i'); // Check is case insensitive
    for (const k of Object.keys(process.env)) { // Find all keys that match
      if (k.includes('_') && (!key || matcher.test(k))) { // Require at least one level
        this.bindEnvByParts(obj, key ? k.substring(key.length + 1).split('_') : k.split('_'), process.env[k]!);
      }
    }
  }

  /**
   * Take a split env var and bind to the object
   */
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

  /**
   * Bind `src` to `target`
   */
  static bindTo(src: any, target: any, key?: string) {
    const keys = (key ? key.split('.') : []);
    let sub: any = src;

    while (keys.length && sub) {
      const next = keys.shift()!;
      sub = sub[next];
    }

    if (sub) {
      Util.deepAssign(target, sub);
    }

    this.bindEnvByKey(target, key);

    return target;
  }

  /**
   * Build redacting regex
   */
  static buildRedactRegex(base: string[]) {
    // Support custom redacted keys
    return new RegExp(`(${base.filter(x => !!x).join('|')})`, 'i');
  }

  /**
   * Sanitize payload
   */
  static sanitizeValuesByKey(obj: any, patterns: string[]) {
    const regex = this.buildRedactRegex(patterns);

    const full = this.toFullKeys(obj);
    for (const [k, value] of Object.entries(full)) {
      if (typeof value === 'string' && regex.test(k)) {
        full[k] = '*'.repeat(value.length);
      }
    }
    return this.breakDownKeys(full) as any;
  }
}