type Prim = number | boolean | string;
export type HttpHeadersInit = Headers | Record<string, undefined | null | Prim | Prim[]>;

/**
 * Tools for handling header objects
 */
export class HttpHeaders extends Headers {

  constructor(o?: HttpHeadersInit) {
    super(o instanceof Headers ? o : undefined);

    if (o && !(o instanceof Headers)) {
      for (const [k, v] of Object.entries(o)) {
        if (v !== undefined && v !== null) {
          if (Array.isArray(v)) {
            this.delete(k);
            for (const sv of v) {
              this.append(k, typeof sv === 'string' ? sv : `${sv}`);
            }
          } else {
            this.set(k, typeof v === 'string' ? v : `${v}`);
          }
        }
      }
    }
  }

  setFunctionalHeaders(...configs: (Record<string, string | (() => string)> | undefined)[]): this {
    for (const config of configs) {
      for (const [k, v] of Object.entries(config ?? {})) {
        this.set(k, typeof v === 'function' ? v() : v);
      }
    }
    return this;
  }

  getList(key: string): string[] | undefined {
    const v = this.get(key);
    if (!v) {
      return;
    }
    return v.split(key === 'cookie' ? /\s{0,3};\s{0,3}/ : /\s{0,3},\s{0,3}/);
  }

  getFirst(key: string): string | undefined {
    return this.getList(key)?.[0];
  }

  toSingle(): Record<string, string> {
    const out = Object.fromEntries(this.entries());
    const cookies = this.getSetCookie();
    if (cookies.length) {
      out['set-cookie'] = cookies.join('; ');
    }
    return out;
  }

  toMulti(): Record<string, string[]> {
    return Object.fromEntries([...this.keys()].map(k => [k, this.getList(k)!]));
  }

  applyTo(set: (k: string, v: string | string[]) => void): void {
    for (const [k, v] of this.entries()) {
      set(k, k === 'set-cookie' ? this.getSetCookie() : v);
    }
  }

  addCookie(value: string): void {
    this.append('set-cookie', value);
  }
}