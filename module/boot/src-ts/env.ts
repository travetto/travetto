/**
 * Basic utils for reading environment variables
 */
export class EnvUtil {

  /**
   * Get, check for key as passed, as all upper and as all lowercase
   */
  static get(k: string, def: string): string;
  static get(k: string, def?: string): string | undefined;
  static get(k: string, def?: string | undefined): string | undefined {
    return process.env[k] ??
      process.env[k.toLowerCase()] ??
      process.env[k.toUpperCase()] ??
      def;
  }

  /**
   * Read value as a comma-separated list
   */
  static getList(k: string) {
    return (this.get(k) ?? '').split(/[, ]+/g).filter(x => !!x);
  }

  /**
   * Read value as an integer
   */
  static getInt(k: string, def: number | string) {
    return parseInt(this.get(k, `${def}`) ?? '', 10);
  }

  /**
   * Determine if value is set explicitly
   */
  static isSet(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '';
  }

  /**
   * Read value as true
   */
  static isTrue(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '' && /^(1|true|on|yes)$/i.test(val);
  }

  /**
   * Read value as false
   */
  static isFalse(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '' && /^(0|false|off|no)$/i.test(val);
  }
}