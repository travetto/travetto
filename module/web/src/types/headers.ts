import { castTo } from '@travetto/runtime';
import { IncomingHttpHeaders } from 'node:http';

type HeaderValue = string | string[] | readonly string[];
export type HttpHeaderMap = Record<string, HeaderValue | (() => HeaderValue)>;

/**
 * Http Payload as a simple object
 */
export class HttpHeaders {

  #headerNames: Record<string, string> = {};
  #headers: Record<string, string> = {};

  constructor(headers?: IncomingHttpHeaders | HttpHeaderMap, readonly = false) {
    if (headers) {
      this.setAll(headers);
      if (readonly) {
        Object.freeze(this.#headers);
        Object.freeze(this.#headerNames);
      }
    }
  }

  getNames(): string[] {
    return [...Object.keys(this.#headers ?? {})];
  }

  has(key: string): boolean {
    return key.toLowerCase() in this.#headerNames;
  }

  get(key: string): string | undefined {
    return this.#headers![this.#headerNames[key.toLowerCase()]];
  }

  getFirst(key: string): string | undefined {
    return this.getList(key)?.[0];
  }

  getList(key: string): string[] | undefined {
    if (!this.has(key)) {
      return;
    }
    const res = this.get(key)!;
    if (Array.isArray(res)) {
      return res;
    }

    const lk = key.toLowerCase();
    if (lk === 'set-cookie') {
      return [res];
    } else if (lk === 'cookie') {
      return res.split(/\s{0,3};\s{0,3}/);
    } else {
      return res.split(/\s{0,3},\s{0,3}/);
    }
  }

  toObject(): Record<string, string> {
    return this.#headers;
  }

  toMap(): Map<string, string> {
    return new Map(Object.entries(this.#headers));
  }

  set(key: string, value: HttpHeaderMap[string]): void {
    const lk = key.toLowerCase();
    const fk = this.#headerNames[lk] ??= key;
    let out = typeof value === 'function' ? value() : value;
    if (Array.isArray(out)) {
      if (!out.length) {
        out = undefined!;
      } else if (lk !== 'set-cookie') {
        out = out.join(', ');
      }
    }
    if (out) {
      this.#headers[fk] = castTo(out);
    } else {
      this.delete(fk);
    }
  }

  append(key: string, value: string): void {
    const header = this.getList(key) ?? [];
    if (!header.includes(value)) {
      this.set(key, [...header, value]);
    }
  }

  delete(key: string): void {
    const lk = key.toLowerCase();
    if (lk in this.#headerNames) {
      const fk = this.#headerNames[lk];
      delete this.#headers![fk];
      delete this.#headerNames[lk];
    }
  }

  setAll(o: IncomingHttpHeaders | HttpHeaderMap | HttpHeaders, ifMissing = false): this {
    if (o instanceof HttpHeaders) {
      o = o.toObject();
    }
    for (const [k, v] of Object.entries(o)) {
      if (ifMissing && this.has(k)) {
        continue;
      }
      if (v) {
        this.set(k, v);
      }
    }
    return this;
  }
}
