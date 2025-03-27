import { HttpHeaderMap } from '../types';

type V = string | string[];

/**
 * Http Payload as a simple object
 */
export class HttpHeaders {

  #headerNames: Record<string, string> = {};
  #headers: Record<string, V> = {};

  constructor(headers: HttpHeaderMap, readonly = false) {
    this.setAll(headers);
    if (readonly) {
      Object.freeze(this.#headers);
      Object.freeze(this.#headerNames);
    }
  }

  getNames(): string[] {
    return [...Object.keys(this.#headers ?? {})];
  }

  has(key: string): boolean {
    return key.toLowerCase() in this.#headerNames;
  }

  get(key: string): V | undefined {
    return this.#headers![this.#headerNames[key.toLowerCase()]];
  }

  toObject(): Record<string, V> {
    return Object.freeze(this.#headers!);
  }

  set(key: string, value: (() => V) | V): void {
    const lk = key.toLowerCase();
    const fk = this.#headerNames[lk] ??= key;
    this.#headers[fk] = typeof value === 'function' ? value() : value;
  }

  append(key: string, value: string, separator = ', '): void {
    const header = this.get(key);
    if (!header?.includes(value)) {
      this.set(key, header ? `${header}${separator}${value}` : value);
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

  setAll(o: Record<string, V | (() => string)>): this {
    for (const [k, v] of Object.entries(o)) {
      this.set(k, typeof v === 'function' ? v() : v);
    }
    return this;
  }
}
