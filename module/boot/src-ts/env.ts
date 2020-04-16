export class EnvUtil {
  static get(k: string, def: string): string;
  static get(k: string, def?: string): string | undefined;
  static get(k: string, def?: string | undefined): string | undefined {
    return process.env[k] ??
      process.env[k.toLowerCase()] ??
      process.env[k.toUpperCase()] ??
      def;
  }

  static getList(k: string) {
    return (this.get(k) ?? '').split(/[, ]+/g).filter(x => !!x);
  }

  static getInt(k: string, def: number | string) {
    return parseInt(this.get(k, `${def}`) ?? '', 10);
  }

  static isSet(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '';
  }

  static isTrue(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '' && /^(1|true|on|yes)$/i.test(val);
  }

  static isFalse(k: string) {
    const val = this.get(k);
    return val !== undefined && val !== '' && /^(0|false|off|no)$/i.test(val);
  }
}