import { RuntimeError } from '@travetto/runtime';

import type { Cookie, CookieGetOptions, CookieSetOptions } from '../types/cookie.ts';
import { KeyGrip } from './keygrip.ts';
import { WebHeaderUtil } from './header.ts';

const pairText = (cookie: Cookie): string => `${cookie.name}=${cookie.value}`;
const pair = (key: string, value: unknown): string => `${key}=${value}`;

type CookieJarOptions = CookieSetOptions;

export class CookieJar {

  #grip: KeyGrip;
  #cookies: Record<string, Cookie> = {};
  #setOptions: CookieSetOptions = {};
  #deleteOptions: CookieSetOptions = { maxAge: 0, expires: undefined };

  constructor(options: CookieJarOptions = {}, keys?: string[] | KeyGrip) {
    this.#grip = (keys instanceof KeyGrip ? keys : new KeyGrip(keys ?? []));
    this.#setOptions = {
      secure: false,
      path: '/',
      ...options,
    };
  }

  get shouldSign(): boolean {
    return this.#setOptions.signed ?? this.#grip.active;
  }

  async export(cookie: Cookie, response?: boolean): Promise<string[]> {
    const suffix = response ? WebHeaderUtil.buildCookieSuffix(cookie) : null;
    const payload = pairText(cookie);
    const out = suffix ? [[payload, ...suffix].join(';')] : [payload];
    if (cookie.signed) {
      const sigPair = pair(`${cookie.name}.sig`, await this.#grip.sign(payload));
      out.push(suffix ? [sigPair, ...suffix].join(';') : sigPair);
    }
    return out;
  }

  async import(cookies: Cookie[]): Promise<void> {
    const signatures: Record<string, string> = {};
    for (const cookie of cookies) {
      if (this.shouldSign && cookie.name.endsWith('.sig')) {
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
      const result = await this.#grip.isValid(computed, value);

      if (result === 'invalid') {
        delete this.#cookies[name];
      } else if (result === 'stale') {
        cookie.response = true;
      }
    }
  }

  has(name: string, options: CookieGetOptions = {}): boolean {
    const needSigned = options.signed ?? this.shouldSign;
    return name in this.#cookies && this.#cookies[name].signed === needSigned;
  }

  get(name: string, options: CookieGetOptions = {}): string | undefined {
    if (this.has(name, options)) {
      return this.#cookies[name]?.value;
    }
  }

  set(cookie: Cookie): void {
    const alias = {
      ...this.#setOptions,
      ...cookie,
      response: true,
      ...(cookie.value === null || cookie.value === undefined) ? this.#deleteOptions : {},
    };

    alias.signed ??= this.shouldSign;

    if (!this.#setOptions.secure && alias.secure) {
      throw new RuntimeError('Cannot send secure cookie over unencrypted connection');
    }

    if (alias.signed && !this.#grip.active) {
      throw new RuntimeError('Signing keys required for signed cookies');
    }

    if (alias.maxAge !== undefined && !alias.expires) {
      alias.expires = new Date(Date.now() + alias.maxAge);
    }

    this.#cookies[cookie.name] = alias;
  }

  getAll(): Cookie[] {
    return Object.values(this.#cookies);
  }

  importCookieHeader(header: string | null | undefined): Promise<void> {
    return this.import(WebHeaderUtil.parseCookieHeader(header ?? ''));
  }

  importSetCookieHeader(headers: string[] | null | undefined): Promise<void> {
    return this.import(headers?.map(WebHeaderUtil.parseSetCookieHeader) ?? []);
  }

  exportCookieHeader(): Promise<string> {
    return Promise.all(this.getAll()
      .map(cookie => this.export(cookie)))
      .then(parts => parts.flat().join('; '));
  }

  exportSetCookieHeader(): Promise<string[]> {
    return Promise.all(this.getAll()
      .filter(cookie => cookie.response)
      .map(cookie => this.export(cookie, true)))
      .then(parts => parts.flat());
  }
}