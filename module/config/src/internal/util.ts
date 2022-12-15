import { Class, Util } from '@travetto/base';
import { BindUtil, SchemaRegistry, ViewConfig } from '@travetto/schema';

/**
 * Simple Config Utilities
 */
export class ConfigUtil {

  /**
   * Find the key using case insensitive search
   */
  static #getKeyName(key: string, fields: string[]): string | undefined {
    key = key.trim();
    const match = new RegExp(key, 'i');
    const next = fields.find(x => match.test(x));
    return next;
  }

  /**
   * Takes a env var, and produces a partial object against a schema definition.  Does not support arrays, only objects.
   */
  static #expandEnvEntry(cls: Class, key: string, value: unknown): Record<string, unknown> | undefined {
    const parts = key.split('_');

    const lastPart = parts.pop()!;

    if (!lastPart) {
      return;
    }

    let cfg: ViewConfig | undefined = SchemaRegistry.getViewSchema(cls);
    let data: Record<string, unknown> = {};
    const root = data;

    while (parts.length) {
      let part = parts.shift();
      if (cfg) {
        part = this.#getKeyName(part!, cfg.fields);
        if (!part) {
          return;
        }
        const subType: Class = cfg.schema[part].type;
        if (SchemaRegistry.has(subType)) {
          cfg = SchemaRegistry.getViewSchema(subType);
        } else if (subType === Object) { // wildcard
          cfg = undefined;
        } else {
          break;
        }
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      data = ((data[part!] ??= {}) as Record<string, unknown>); // Recurse
    }

    const lastKey = (cfg ? this.#getKeyName(lastPart, cfg.fields) : undefined) ?? (/^[A-Z_0-9]+$/.test(lastPart) ? lastPart.toLowerCase() : lastPart);
    if (typeof value === 'string' && value.includes(',')) {
      value = value.trim().split(/\s*,\s*/);
    }
    data[lastKey] = value;

    return root;
  }

  /**
   * Bind the environment variables onto an object structure when they match by name.
   * Will split on _ to handle nesting appropriately
   */
  static getEnvOverlay(cls: Class, ns: string): Record<string, unknown> {
    // Handle process.env on bind as the structure we need may not
    // fully exist until the config has been created
    const nsRe = new RegExp(`^${ns.replace(/[.]/g, '_')}`, 'i'); // Check is case insensitive
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(process.env)) { // Find all keys that match ns
      if (k.includes('_') && nsRe.test(k)) { // Require at least one level (nothing should be at the top level as all configs are namespaced)
        Util.deepAssign(data, this.#expandEnvEntry(cls, ns ? k.substring(ns.length + 1) : k, v), 'coerce');
      }
    }
    return data;
  }

  /**
   * Looks up root object by namespace
   * @param src
   * @param ns
   * @returns
   */
  static lookupRoot(src: Record<string, unknown>, ns?: string, createIfMissing = false): Record<string, unknown> {
    const parts = (ns ? ns.split('.') : []);
    let sub: Record<string, unknown> = src;

    while (parts.length && sub) {
      const next = parts.shift()!;
      if (createIfMissing && !sub[next]) {
        sub[next] = {};
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      sub = sub[next] as Record<string, unknown>;
    }

    return sub;
  }

  /**
   * Sanitize payload
   */
  static sanitizeValuesByKey<T extends Record<string, unknown>>(obj: T, patterns: string[]): T {
    // Support custom redacted keys
    const regex = new RegExp(`(${patterns.filter(x => !!x).join('|')})`, 'i');

    const full = BindUtil.flattenPaths(obj);
    for (const [k, value] of Object.entries(full)) {
      if (typeof value === 'string' && regex.test(k)) {
        full[k] = '*'.repeat(10);
      }
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return BindUtil.expandPaths(full) as T;
  }
}