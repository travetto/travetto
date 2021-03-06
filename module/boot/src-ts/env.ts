import { PathUtil } from './path';

/**
 * Basic utils for reading environment variables
 */
export class EnvUtil {

  static #dynamicModules: Record<string, string>;

  /**
   * Get all relevant environment values
   */
  static getAll() {
    return Object.fromEntries(Object.entries(process.env)
      .filter(([k]) => /^(TRV_.*|NODE_(PATH|OPTIONS)|PATH)$/.test(k))
      .sort((a, b) => a[0].localeCompare(b[0]))
    );
  }

  /**
   * Get, check for key as passed, as all upper and as all lowercase
   * @param k The environment key to search for
   * @param def The default value if the key isn't found
   */
  static get(k: string, def: string): string;
  static get(k: string, def?: string): string | undefined;
  static get(k: string, def?: string | undefined): string | undefined {
    return process.env[k] ??
      process.env[k.toUpperCase()] ??
      process.env[k.toLowerCase()] ??
      def;
  }

  /**
   * Read value as a comma-separated list
   * @param k The environment key to search for
   */
  static getList(k: string, append?: string[]) {
    return [...(this.get(k) ?? '').split(/[, ]+/g), ...(append ?? [])]
      .map(x => x.trim())
      .filter(x => !!x);
  }

  /**
   * Read value as a comma-separated list of pairs separated by '='
   * @param k The environment key to search for
   */
  static getEntries(k: string, sep = '=') {
    return (this.get(k) ?? '')
      .split(/[, ]+/g)
      .map(x => x.trim())
      .filter(x => !!x)
      .map(x => {
        const [p, v] = x.split(sep);
        return [p, v || undefined] as [string, string];
      })
      .filter(([p, v]) => !!p);
  }

  /**
   * Read value as an integer
   * @param k The environment key to search for
   * @param def The default value if the key isn't found
   */
  static getInt(k: string, def: number | string) {
    return parseInt(this.get(k, `${def}`) ?? '', 10);
  }

  /**
   * Get a key as a boolean value, false === false, undefined === undefined and everything else is true
   * @param key
   */
  static getBoolean(key: string): boolean | undefined {
    return this.isSet(key) && this.get(key) !== '' ? !this.isFalse(key) : undefined;
  }

  /**
   * Determine if value is set explicitly
   * @param k The environment key to search for
   */
  static isSet(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '';
  }

  /**
   * Read value as true
   * @param k The environment key to search for
   */
  static isTrue(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '' && /^(1|true|on|yes)$/i.test(val);
  }

  /**
   * Read value as false
   * @param k The environment key to search for
   */
  static isFalse(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '' && /^(0|false|off|no)$/i.test(val);
  }

  /**
   * Checks to see if the negative is set
   * @param key The environment key to search for
   * @param values The list of acceptable values for the key
   * @param def The default value if the key isn't found
   */
  static isValueOrFalse<T extends readonly string[]>(key: string, values: T, def?: T[number]): T[number] | false {
    if (this.isFalse(key)) {
      return false;
    } else {
      let val: T[number] | false = this.get(key, def) as T[number];
      if (!values.includes(val)) {
        val = def as T[number];
      }
      return val === undefined ? false : val;
    }
  }

  /**
   * Can use compile
   */
  static isProd() {
    return /^prod(uction)?$/i.test(EnvUtil.get('TRV_ENV', ''));
  }

  /**
   * Can use compile
   */
  static isReadonly() {
    return this.isProd() ? !this.isFalse('TRV_READONLY') : this.isTrue('TRV_READONLY');
  }

  /**
   * Is the app in dynamic mode?
   */
  static isDynamic() {
    return !this.isProd() && this.isTrue('TRV_DYNAMIC');
  }

  /**
   * Get dynamic modules
   */
  static getDynamicModules() {
    if (this.#dynamicModules === undefined) {
      this.#dynamicModules = Object.fromEntries(
        this.getEntries('TRV_MODULES')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, v || PathUtil.resolveFrameworkPath(PathUtil.resolveUnix('node_modules', k))])
      );
    }
    return this.#dynamicModules;
  }
}