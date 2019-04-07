export class EnvUtil {

  static get(k: string, def: string): string;
  static get(k: string, def?: string): string | undefined;
  static get(k: string, def?: string | undefined): string | undefined {
    const temp = process.env[k] || process.env[k.toLowerCase()] || process.env[k.toUpperCase()];
    return temp === undefined ? def : temp;
  }

  static getList(k: string) {
    return (this.get(k) || '').split(/[, ]+/g).filter(x => !!x);
  }

  static getInt(k: string, def: number | string) {
    return parseInt(this.get(k, `${def}`) || '', 10);
  }

  static isTrue(k: string) {
    const val = this.get(k);
    return val !== undefined && /^(1|true|on|yes)$/i.test(val);
  }

  static isFalse(k: string) {
    const val = this.get(k);
    return val !== undefined && /^(0|false|off|no)$/i.test(val);
  }
}