import keygrip from 'keygrip';
import { AppError, castKey, castTo } from '@travetto/runtime';

import { Cookie, CookieGetOptions } from '../types/cookie.ts';

const pairText = (c: Cookie): string => `${c.name}=${c.value}`;
const pair = (k: string, v: unknown): string => `${k}=${v}`;

export class CookieJar {

  static fromHeaderValue(header: string): Cookie {
    const parts = header.split(/\s{0,4};\s{0,4}/g);
    const [name, value] = parts[0].split(/\s{0,4}=\s{0,4}/);
    const c: Cookie = { name, value };
    for (const p of parts.slice(1)) {
      // eslint-disable-next-line prefer-const
      let [k, v = ''] = p.split(/\s{0,4}=\s{0,4}/);
      if (v[0] === '"') {
        v = v.slice(1, -1);
      }
      if (k === 'expires') {
        c[k] = new Date(v);
      } else {
        c[castKey(k)] = castTo(v || true);
      }
    }
    return c;
  }

  static toHeaderValue(c: Cookie, response = true): string {
    const header = [pair(c.name, c.value)];
    if (response) {
      if (!c.value) {
        c.expires = new Date(0);
        c.maxAge = undefined;
      }
      if (c.maxAge) {
        c.expires = new Date(Date.now() + c.maxAge);
      }

      if (c.path) { header.push(pair('path', c.path)); }
      if (c.expires) { header.push(pair('expires', c.expires.toUTCString())); }
      if (c.domain) { header.push(pair('domain', c.domain)); }
      if (c.priority) { header.push(pair('priority', c.priority.toLowerCase())); }
      if (c.sameSite) { header.push(pair('samesite', c.sameSite.toLowerCase())); }
      if (c.secure) { header.push('secure'); }
      if (c.httpOnly) { header.push('httponly'); }
      if (c.partitioned) { header.push('partitioned'); }
    }
    return header.join(';');
  }

  #secure?: boolean;
  #grip?: keygrip;
  #cookies: Record<string, Cookie> = {};

  constructor(input?: string | string[] | null | undefined | Cookie[] | CookieJar, options?: { keys?: string[], secure?: boolean }) {
    this.#grip = options?.keys?.length ? new keygrip(options.keys) : undefined;
    this.#secure = options?.secure ?? false;
    if (input instanceof CookieJar) {
      this.#cookies = { ...input.#cookies };
    } else if (Array.isArray(input)) {
      this.#import(input);
    } else {
      this.#import(input?.split(/\s{0,4},\s{0,4}/) ?? []);
    }
  }

  #checkSignature(c: Cookie): Cookie | undefined {
    if (!this.#grip) { return; }
    const key = pairText(c);
    const sc = this.#cookies[`${c.name}.sig`];
    if (!sc.value) { return; }

    const index = this.#grip.index(key, sc.value);
    c.signed = index >= 0;
    sc.signed = false;
    sc.secure = c.secure;

    if (index >= 1) {
      sc.value = this.#grip.sign(key);
      sc.response = true;
      return sc;
    }
  }

  #signCookie(c: Cookie): Cookie {
    if (!this.#grip) {
      throw new AppError('.keys required for signed cookies');
    } else if (!this.#secure && c.secure) {
      throw new AppError('Cannot send secure cookie over unencrypted connection');
    }
    return { ...c, name: `${c.name}.sig`, value: this.#grip.sign(pairText(c)) };
  }

  #import(inputs: (string | Cookie)[]): void {
    const toCheck = [];
    for (const input of inputs) {
      const c = typeof input === 'string' ? CookieJar.fromHeaderValue(input) : input;
      this.#cookies[c.name] = c;
      if (this.#grip && !c.name.endsWith('.sig')) {
        toCheck.push(c);
      }
    }
    for (const c of toCheck) {
      const sc = this.#checkSignature(c);
      if (sc) {
        this.set(sc);
      }
    }
  }

  get(name: string, opts: CookieGetOptions = {}): string | undefined {
    const c = this.#cookies[name];
    return (c?.signed || !(opts.signed ?? !!this.#grip)) ? c?.value : undefined;
  }

  set(c: Cookie): void {
    this.#cookies[c.name] = c;
    c.secure ??= this.#secure;
    c.signed ??= !!this.#grip;
    c.response = true;

    if (c.value === null || c.value === undefined) {
      c.maxAge = -1;
      c.expires = undefined;
    }

    if (c.signed) {
      const sc = this.#signCookie(c);
      this.#cookies[sc.name] = sc;
      sc.response = true;
    }
  }

  export(response = true): string[] {
    return this.getAll()
      .filter(x => !response || x.response)
      .map(c => CookieJar.toHeaderValue(c, response));
  }

  getAll(): Cookie[] {
    return Object.values(this.#cookies);
  }
}