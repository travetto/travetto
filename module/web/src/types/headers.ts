import { type Any, castTo } from '@travetto/runtime';

type Prim = number | boolean | string;
type HeaderValue = Prim | Prim[] | readonly Prim[];
export type WebHeadersInit = Headers | Record<string, undefined | null | HeaderValue> | [string, HeaderValue][];

/**
 * Simple Headers wrapper with additional logic for common patterns
 */
export class WebHeaders extends Headers {

  constructor(input?: WebHeadersInit) {
    const passed = (input instanceof Headers);
    super(passed ? input : undefined);

    if (input && !passed) {
      for (const [key, value] of (Array.isArray(input) ? input : Object.entries(input))) {
        if (value !== undefined && value !== null && !key.startsWith(':')) {
          this.append(key, castTo(value));
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
    const value = this.get(key);
    if (!value) {
      return;
    } else if (value.toLowerCase() === 'set-cookie') {
      return this.getSetCookie();
    }
    return value.split(key === 'cookie' ? /\s{0,3};\s{0,3}/ : /\s{0,3},\s{0,3}/);
  }

  // @ts-expect-error
  forEach(set: (value: string | string[], key: string, headers: WebHeaders) => void): void;
  forEach(set: (value: Any, key: string, headers: WebHeaders) => void): void;
  forEach(set: (value: string | string[], key: string, headers: WebHeaders) => void): void {
    for (const [key, value] of this.entries()) {
      set(key === 'set-cookie' ? this.getSetCookie() : value, key, this);
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