/**
 * Http Headers
 */
export class HttpHeaders extends Headers {

  static fromInput(o?: HttpHeaders | Headers | Record<string, undefined | number | boolean | string | (number | boolean | string)[]>): HttpHeaders {
    if (o instanceof HttpHeaders) {
      return o;
    } else if (!o || o instanceof Headers) {
      return new HttpHeaders(o);
    }

    const h = new HttpHeaders();
    for (const [k, v] of Object.entries(o)) {
      if (v !== undefined && v !== null) {
        if (Array.isArray(v)) {
          h.set(k, '');
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

  constructor(headers?: Record<string, string> | Headers) {
    super(headers instanceof Headers ? headers : headers);
  }

  getFirst(key: string): string | undefined {
    return this.getList(key)?.[0];
  }

  getList(key: string): string[] | undefined {
    if (!this.has(key)) {
      return;
    }
    const lk = key.toLowerCase();
    if (lk === 'set-cookie') {
      return this.getSetCookie();
    } else {
      return this.get(lk)?.split(lk === 'cookie' ? /\s{0,3};\s{0,3}/ : /\s{0,3},\s{0,3}/);
    }
  }

  applyTo(set: (k: string, v: string | string[]) => void): void {
    for (const [k, v] of this.entries()) {
      set(k, k === 'set-cookie' ? this.getSetCookie() : v);
    }
  }
}
