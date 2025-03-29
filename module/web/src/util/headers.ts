export type HttpHeadersInit = Headers | Record<string, undefined | null | number | boolean | string | (number | boolean | string)[]>;

/**
 * Tools for handling header objects
 */
export class HttpHeaderUtil {

  static getList(headers: Headers, key: string): string[] | undefined {
    const v = headers.get(key);
    if (!v) {
      return;
    }
    return v.split(key === 'cookie' ? /\s{0,3};\s{0,3}/ : /\s{0,3},\s{0,3}/);
  }

  static getFirst(headers: Headers, key: string): string | undefined {
    return this.getList(headers, key)?.[0];
  }

  static fromInput(o?: HttpHeadersInit): Headers {
    if (o instanceof Headers) {
      return o;
    } else if (!o) {
      return new Headers();
    }

    const h = new Headers();
    for (const [k, v] of Object.entries(o)) {
      if (v !== undefined && v !== null) {
        if (Array.isArray(v)) {
          h.delete(k);
          for (const sv of v) {
            h.append(k, typeof sv === 'string' ? sv : `${sv}`);
          }
        } else {
          h.set(k, typeof v === 'string' ? v : `${v}`);
        }
      }
    }
    return h;
  }

  static applyTo(headers: Headers, set: (k: string, v: string | string[]) => void): void {
    for (const [k, v] of headers.entries()) {
      set(k, k === 'set-cookie' ? headers.getSetCookie() : v);
    }
  }

  static toSingle(headers: Headers): Record<string, string> {
    const out = Object.fromEntries(headers.entries());
    const cookies = headers.getSetCookie();
    if (cookies.length) {
      out['set-cookie'] = cookies.join('; ');
    }
    return out;
  }

  static toMulti(headers: Headers): Record<string, string[]> {
    return Object.fromEntries([...headers.keys()].map(k => [k, this.getList(headers, k)!]));
  }

  static setFunctionalHeaders(headers: Headers, ...configs: (Record<string, string | (() => string)> | undefined)[]): void {
    for (const config of configs) {
      for (const [k, v] of Object.entries(config ?? {})) {
        headers.set(k, typeof v === 'function' ? v() : v);
      }
    }
  }
}