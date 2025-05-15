import { Any, castTo } from '@travetto/runtime';

type Prim = number | boolean | string;
type HeaderValue = Prim | Prim[] | readonly Prim[];
export type WebHeadersInit = Headers | Record<string, undefined | null | HeaderValue> | [string, HeaderValue][];

/**
 * Simple Headers wrapper with additional logic for common patterns
 */
export class WebHeaders extends Headers {

  constructor(o?: WebHeadersInit) {
    const passed = (o instanceof Headers);
    super(passed ? o : undefined);

    if (o && !passed) {
      for (const [k, v] of (Array.isArray(o) ? o : Object.entries(o))) {
        if (v !== undefined && v !== null && !k.startsWith(':')) {
          this.append(k, castTo(v));
        }
      }
    }
  }

  /** Set if key not already set */
  setIfAbsent(key: string, value: string): void {
    if (!this.has(key)) {
      this.set(key, value);
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
  forEach(set: (v: string | string[], k: string, headers: WebHeaders) => void): void;
  forEach(set: (v: Any, k: string, headers: WebHeaders) => void): void;
  forEach(set: (v: string | string[], k: string, headers: WebHeaders) => void): void {
    for (const [k, v] of this.entries()) {
      set(k === 'set-cookie' ? this.getSetCookie() : v, k, this);
    }
  }

  /**
   * Set header value with a prefix
   */
  setWithPrefix(key: string, value: string | undefined, prefix: string = ''): void {
    value ? this.set(key, `${prefix} ${value}`.trim()) : this.delete(key);
  }

  /**
   * Get with prefix
   */
  getWithPrefix(key: string, prefix: string = ''): string | undefined {
    return this.get(key)?.replace(prefix, '').trim();
  }
}