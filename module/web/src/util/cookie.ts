import { RuntimeError } from '@travetto/runtime';

import type { Cookie, CookieGetOptions, CookieSetOptions } from '../types/cookie.ts';
import { KeyGrip } from './keygrip.ts';
import { WebHeaderUtil } from './header.ts';

const pairText = (cookie: Cookie): string => `${cookie.name}=${cookie.value}`;
const pair = (key: string, value: unknown): string => `${key}=${value}`;

type CookieJarOptions = { keys?: string[] } & CookieSetOptions;

export class CookieJar {

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
    const suffix = response ? WebHeaderUtil.buildCookieSuffix(cookie) : null;
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

  has(name: string, options: CookieGetOptions = {}): boolean {
    const needSigned = options.signed ?? this.#setOptions.signed;
    return name in this.#cookies && this.#cookies[name].signed === needSigned;
  }

  get(name: string, options: CookieGetOptions = {}): string | undefined {
    if (this.has(name, options)) {
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
      throw new RuntimeError('Cannot send secure cookie over unencrypted connection');
    }

    if (alias.signed && !this.#grip) {
      throw new RuntimeError('Signing keys required for signed cookies');
    }

    if (alias.maxAge !== undefined && !alias.expires) {
      alias.expires = new Date(Date.now() + alias.maxAge);
    }
  }

  getAll(): Cookie[] {
    return Object.values(this.#cookies);
  }

  importCookieHeader(header: string | null | undefined): this {
    return this.import(WebHeaderUtil.parseCookieHeader(header ?? ''));
  }

  importSetCookieHeader(headers: string[] | null | undefined): this {
    return this.import(headers?.map(WebHeaderUtil.parseSetCookieHeader) ?? []);
  }

  exportCookieHeader(): string {
    return this.getAll().flatMap(cookie => this.#exportCookie(cookie)).join('; ');
  }

  exportSetCookieHeader(): string[] {
    return this.getAll()
      .filter(cookie => cookie.response)
      .flatMap(cookie => this.#exportCookie(cookie, true));
  }
}