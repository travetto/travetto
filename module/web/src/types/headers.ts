import { castTo } from '@travetto/runtime';
import { IncomingHttpHeaders } from 'node:http';

/**
 * Http Headers
 */
export class HttpHeaders extends Headers {

  static fromIncomingHeaders(o: IncomingHttpHeaders): HttpHeaders {
    const v = new HttpHeaders(castTo(o));
    const c = o['set-cookie'];
    if (Array.isArray(c)) {
      v.set('set-cookie', '');
      for (const i of c) {
        v.append('set-cookie', i);
      }
    }
    return v;
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

  applyTo(setHeader: (k: string, v: string | string[]) => void): void {
    for (const [k, v] of this.entries()) {
      setHeader(k, v);
    }
    const cookies = this.getSetCookie();
    if (cookies.length) {
      setHeader('set-cookie', this.getSetCookie());
    }
  }

  toMulti(): Record<string, string[]> {
    return Object.fromEntries([...this.keys()].map(k => [k, this.getList(k) ?? []]));
  }

  toSingle(): Record<string, string> {
    const out = Object.fromEntries(this.entries());
    const cookies = this.getSetCookie();
    if (cookies.length) {
      out['set-cookie'] = cookies.join('; ');
    }
    return out;
  }
}
