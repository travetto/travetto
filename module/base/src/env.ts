/// <reference path="./_env.d.ts" />

type EnvKey = keyof TrvEnv;
type EnvList = { [K in keyof TrvEnv]: TrvEnv[K] extends unknown[] ? K : never }[keyof TrvEnv];
type EnvBool = { [K in keyof TrvEnv]: Extract<TrvEnv[K], boolean> extends never ? never : K }[keyof TrvEnv];
type EnvNumber = { [K in keyof TrvEnv]: Extract<TrvEnv[K], number> extends never ? never : K }[keyof TrvEnv];
type EnvBasic = Record<string, string[] | number | boolean | string | undefined>;

/**
 * Basic utils for reading environment variables
 */
export class Env {

  /**
   * Get, check for key as passed, as all upper and as all lowercase
   * @param k The environment key to search for
   * @param def The default value if the key isn't found
   */
  static get(k: EnvKey, def: string): string;
  static get(k: EnvKey, def?: string): string | undefined;
  static get(k: string, def: string): string;
  static get(k: string, def?: string): string | undefined;
  static get(k: string | EnvKey, def?: string | undefined): string | undefined {
    return (process.env[k] ?? process.env[k.toUpperCase()] ?? process.env[k.toLowerCase()]) || def;
  }

  /**
   * Read value as a comma-separated list
   * @param k The environment key to search for
   */
  static getList(k: EnvList, def: string[]): string[];
  static getList(k: EnvList, def?: string[] | undefined): string[] | undefined;
  static getList(k: string, def: string[]): string[];
  static getList(k: string, def?: string[] | undefined): string[] | undefined;
  static getList(k: EnvList | string, def?: string[] | undefined): string[] | undefined {
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
  static getInt(k: EnvNumber, def: number): number;
  static getInt(k: string, def: number): number;
  static getInt(k: EnvNumber): number | undefined;
  static getInt(k: string): number | undefined;
  static getInt(k: EnvNumber | string, def?: number): number | undefined {
    const v = this.get(k, '');
    const vi = parseInt(v, 10);
    return Number.isNaN(vi) ? def : vi;
  }

  /**
   * Read value as boolean
   * @param k The environment key to search for
   */
  static getBoolean(k: EnvBool, isValue: boolean): boolean;
  static getBoolean(k: EnvBool): boolean | undefined;
  static getBoolean(k: string, isValue: boolean): boolean;
  static getBoolean(k: string): boolean | undefined;
  static getBoolean(k: EnvBool | string, isValue?: boolean): boolean | undefined {
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
  static isSet(k: EnvKey): boolean;
  static isSet(k: string): boolean;
  static isSet(k: string | EnvKey): boolean {
    const val = this.get(k);
    return val !== undefined && val !== '';
  }

  /**
   * Read value as true
   * @param k The environment key to search for
   */
  static isTrue(k: EnvBool): boolean;
  static isTrue(k: string): boolean;
  static isTrue(k: EnvBool | string): boolean {
    return this.getBoolean(k, true);
  }

  /**
   * Read value as false
   * @param k The environment key to search for
   */
  static isFalse(k: EnvBool): boolean;
  static isFalse(k: string): boolean;
  static isFalse(k: EnvBool | string): boolean {
    return this.getBoolean(k, false);
  }

  /**
   * Set all, coercing values to string, and deleting env vars when
   * the value is undefined
   */
  static set(env: Partial<TrvEnv> & EnvBasic = {}): void {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined || value === null) {
        delete process.env[key];
      } else if (Array.isArray(value)) {
        process.env[key] = `${value.join(',')}`;
      } else {
        process.env[key] = `${value}`;
      }
    }
  }
}