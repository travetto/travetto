export class CommonUtil {
  static isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  static flattenPaths(data: Record<string, unknown> | string | boolean | number | Date, prefix: string = ''): Record<string, unknown> {
    if (!this.isPlainObject(data) && !Array.isArray(data)) {
      if (data !== undefined && data !== '' && data !== null) {
        return { [prefix]: data };
      } else {
        return {};
      }
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = prefix ? `${prefix}.${key}` : key;
      if (this.isPlainObject(value)) {
        Object.assign(out, this.flattenPaths(value, pre)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (this.isPlainObject(v)) {
            Object.assign(out, this.flattenPaths(v, `${pre}[${i}]`));
          } else if (v !== undefined && v !== '' && data !== null) {
            out[`${pre}[${i}]`] = v;
          }
        }
      } else if (value !== undefined && value !== '' && value !== null) {
        out[pre] = value;
      }
    }
    return out;
  }
}