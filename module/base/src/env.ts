/**
 * Basic utils for reading environment variables
 */
export class Env {

  /**
   * Get, check for key as passed, as all upper and as all lowercase
   * @param k The environment key to search for
   * @param def The default value if the key isn't found
   */
  static get<K extends string = string>(k: string, def: K): K;
  static get<K extends string = string>(k: string, def?: K): K | undefined;
  static get<K extends string = string>(k: string, def?: K | undefined): K | undefined {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (process.env[k] ??
      process.env[k.toUpperCase()] ??
      process.env[k.toLowerCase()] ??
      def) as K;
  }

  /**
   * Read value as a comma-separated list
   * @param k The environment key to search for
   */
  static getList(k: string, def: string[]): string[];
  static getList(k: string, def?: string[] | undefined): string[] | undefined;
  static getList(k: string, def?: string[] | undefined): string[] | undefined {
    const val = this.get(k);
    return (val === undefined || val === '') ?
      def : ([...val.split(/[, ]+/g)]
        .map(x => x.trim())
        .filter(x => !!x));
  }

  /**
   * Read value as an integer
   * @param k The environment key to search for
   * @param def The default value if the key isn't found
   */
  static getInt(k: string, def: number | string): number {
    return parseInt(this.get(k, `${def}`) ?? '', 10);
  }

  /**
   * Read value as boolean
   * @param k The environment key to search for
   */
  static getBoolean(k: string, isValue: boolean): boolean;
  static getBoolean(k: string): boolean | undefined;
  static getBoolean(k: string, isValue?: boolean): boolean | undefined {
    const val = this.get(k);
    if (val === undefined || val === '') {
      return isValue ? false : undefined;
    }
    const match = val.match(/^((?<TRUE>true|yes|1|on)|false|no|off|0)$/i);
    return isValue === undefined ? !!match?.groups?.TRUE : !!match?.groups?.TRUE === isValue;
  }

  /**
   * Determine if value is set explicitly
   * @param k The environment key to search for
   */
  static isSet(k: string): boolean {
    const val = this.get(k);
    return val !== undefined && val !== '';
  }

  /**
   * Read value as true
   * @param k The environment key to search for
   */
  static isTrue(k: string): boolean {
    return this.getBoolean(k, true);
  }

  /**
   * Read value as false
   * @param k The environment key to search for
   */
  static isFalse(k: string): boolean {
    return this.getBoolean(k, false);
  }
}