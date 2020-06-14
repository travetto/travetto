/**
 * Basic utils for reading environment variables
 */
export class EnvUtil {

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
   * Get time as milliseconds
   * @param k The environment key to search for
   * @param deTime The default time if the key isn't found
   * @param defUnit The unit for the default time, ms is default if not specified
   */
  static getTime(k: string, defTime: number, defUnit?: 'h' | 'm' | 's'): number {
    let val: string | number = defTime;
    let unit: string | undefined = defUnit;
    let mult = 1;
    const match = this.get(k, '').match(/^(\d+)([hms]?)$/);

    if (match) {
      [, val, unit] = match;
    }

    switch (unit) {
      case 'h': mult = 60 * 60 * 1000; break;
      case 'm': mult = 60 * 1000; break;
      case 's': mult = 1000; break;
    }
    return parseInt(`${val}`, 10) * mult;
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
   * Get the environment
   */
  static getEnv() {
    return this.get('TRV_ENV', this.get('NODE_ENV', 'dev'))
      .replace(/^production$/i, 'prod')
      .replace(/^development$/i, 'dev')
      .toLowerCase();
  }

  /**
   * Determine if app is in prod mode or not
   */
  static isProd() {
    return this.getEnv() === 'prod';
  }

  /**
   * Is the app in watch mode?
   */
  static isWatch() {
    return this.isTrue('TRV_WATCH');
  }

  /**
   * Get module roots
   */
  static getExtModules(...extra: string[]) {
    // TODO: Move out
    // Need a way to determine list of eligible modules, do not want to scan at startup
    const roots = require(`${process.cwd()}/package.json`)['@travetto:modules'] || ['!'];
    return this.getList('TRV_MOD_ROOTS', roots);
  }
}