import { castTo } from '@travetto/runtime';

type Prim = number | boolean | string;
export type HttpHeadersInit = Headers | Record<string, undefined | null | Prim | Prim[]> | [string, Prim | Prim[]][];

/**
 * Simple Headers wrapper with additional logic for common patterns
 */
export class HttpHeaders extends Headers {

  constructor(o?: HttpHeadersInit) {
    const passed = (o instanceof Headers);
    super(passed ? o : undefined);

    if (o && !passed) {
      for (const [k, v] of (Array.isArray(o) ? o : Object.entries(o))) {
        if (v !== undefined && v !== null) {
          this.append(k, castTo(v));
        }
      }
    }
  }

  /**
   * Get a header value as a list, breaking on commas except for cookies
   */
  getList(key: string): string[] | undefined {
    const v = this.get(key);
    if (!v) {
      return;
    } else if (v.toLowerCase() === 'set-cookie') {
      return this.getSetCookie();
    }
    return v.split(key === 'cookie' ? /\s{0,3};\s{0,3}/ : /\s{0,3},\s{0,3}/);
  }

  // @ts-expect-error
  override forEach(set: (v: string | string[], k: string) => void): void {
    for (const [k, v] of this.entries()) {
      set(k === 'set-cookie' ? this.getSetCookie() : v, k);
    }
  }
}