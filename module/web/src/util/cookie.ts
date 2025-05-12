import { AppError, castKey, castTo } from '@travetto/runtime';

import { Cookie, CookieGetOptions, CookieSetOptions } from '../types/cookie.ts';
import { KeyGrip } from './keygrip.ts';

const pairText = (c: Cookie): string => `${c.name}=${c.value}`;
const pair = (k: string, v: unknown): string => `${k}=${v}`;

type CookieJarOptions = { keys?: string[] } & CookieSetOptions;

export class CookieJar {

  static parseCookieHeader(header: string): Cookie[] {
    return header.split(/\s{0,4};\s{0,4}/g)
      .map(x => x.trim())
      .filter(x => !!x)
      .map(item => {
        const kv = item.split(/\s{0,4}=\s{0,4}/);
        return { name: kv[0], value: kv[1] };
      });
  }

  static parseSetCookieHeader(header: string): Cookie {
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

  static responseSuffix(c: Cookie): string[] {
    const parts = [];
    if (c.path) { parts.push(pair('path', c.path)); }
    if (c.expires) { parts.push(pair('expires', c.expires.toUTCString())); }
    if (c.domain) { parts.push(pair('domain', c.domain)); }
    if (c.priority) { parts.push(pair('priority', c.priority.toLowerCase())); }
    if (c.sameSite) { parts.push(pair('samesite', c.sameSite.toLowerCase())); }
    if (c.secure) { parts.push('secure'); }
    if (c.httpOnly) { parts.push('httponly'); }
    if (c.partitioned) { parts.push('partitioned'); }
    return parts;
  }

  #grip?: KeyGrip;
  #cookies: Record<string, Cookie> = {};
  #setOptions: CookieSetOptions = {};
  #deleteOptions: CookieSetOptions = { maxAge: 0, expires: undefined };

  constructor({ keys, ...options }: CookieJarOptions = {}) {
    this.#grip = keys?.length ? new KeyGrip(keys) : undefined;
    this.#setOptions = {
      secure: false,
      path: '/',
      signed: !!keys?.length,
      ...options,
    };
  }

  #exportCookie(cookie: Cookie, response?: boolean): string[] {
    const suffix = response ? CookieJar.responseSuffix(cookie) : null;
    const payload = pairText(cookie);
    const out = suffix ? [[payload, ...suffix].join(';')] : [payload];
    if (cookie.signed) {
      const sigPair = pair(`${cookie.name}.sig`, this.#grip!.sign(payload));
      out.push(suffix ? [sigPair, ...suffix].join(';') : sigPair);
    }
    return out;
  }

  import(cookies: Cookie[]): this {
    const signatures: Record<string, string> = {};
    for (const cookie of cookies) {
      if (this.#setOptions.signed && cookie.name.endsWith('.sig')) {
        signatures[cookie.name.replace(/[.]sig$/, '')] = cookie.value!;
      } else {
        this.#cookies[cookie.name] = { signed: false, ...cookie };
      }
    }

    for (const [name, value] of Object.entries(signatures)) {
      const cookie = this.#cookies[name];
      if (!cookie) {
        continue;
      }
      cookie.signed = true;

      const computed = pairText(cookie);
      const index = this.#grip!.index(computed, value);

      if (index < 0) {
        delete this.#cookies[name];
      } else if (index >= 1) {
        cookie.response = true;
      }
    }
    return this;
  }

  has(name: string, opts: CookieGetOptions = {}): boolean {
    const needSigned = opts.signed ?? this.#setOptions.signed;
    return name in this.#cookies && this.#cookies[name].signed === needSigned;
  }

  get(name: string, opts: CookieGetOptions = {}): string | undefined {
    if (this.has(name, opts)) {
      return this.#cookies[name]?.value;
    }
  }

  set(cookie: Cookie): void {
    const alias = this.#cookies[cookie.name] = {
      ...this.#setOptions,
      ...cookie,
      response: true,
      ...(cookie.value === null || cookie.value === undefined) ? this.#deleteOptions : {},
    };

    if (!this.#setOptions.secure && alias.secure) {
      throw new AppError('Cannot send secure cookie over unencrypted connection');
    }

    if (alias.signed && !this.#grip) {
      throw new AppError('Signing keys required for signed cookies');
    }

    if (alias.maxAge !== undefined && !alias.expires) {
      alias.expires = new Date(Date.now() + alias.maxAge);
    }
  }

  getAll(): Cookie[] {
    return Object.values(this.#cookies);
  }

  importCookieHeader(header: string | null | undefined): this {
    return this.import(CookieJar.parseCookieHeader(header ?? ''));
  }

  importSetCookieHeader(headers: string[] | null | undefined): this {
    return this.import(headers?.map(CookieJar.parseSetCookieHeader) ?? []);
  }

  exportCookieHeader(): string {
    return this.getAll().flatMap(c => this.#exportCookie(c)).join('; ');
  }

  exportSetCookieHeader(): string[] {
    return this.getAll()
      .filter(x => x.response)
      .flatMap(c => this.#exportCookie(c, true));
  }
}