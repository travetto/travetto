import { SystemUtil } from '@travetto/base';
import { ContextProvider } from '@travetto/rest';
import { CacheEntry } from '@travetto/cache';

@ContextProvider((c, req) => req!.session.data)
// TODO: Document
export class SessionData {
  [key: string]: any;
}

@ContextProvider((c, req) => req!.session)
// TODO: Document
export class Session<T = any> implements CacheEntry {
  private expiresAtLoaded: number | undefined;
  private hash: number;

  readonly key: string;
  readonly maxAge?: number;
  readonly signature?: string;
  readonly issuedAt: number;

  expiresAt: number | undefined;
  action?: 'create' | 'destroy' | 'modify';
  data: T;

  constructor(data: Partial<Session>) {
    this.issuedAt = Date.now();

    // Overwrite with data
    Object.assign(this, data);

    this.expiresAtLoaded = this.expiresAt ?? Date.now();

    if (this.maxAge && !this.expiresAt) {
      this.expiresAt = this.maxAge + Date.now();
    }

    this.hash = SystemUtil.naiveHash(JSON.stringify(this));
  }

  isChanged() {
    return this.isTimeChanged() || this.hash !== SystemUtil.naiveHash(JSON.stringify(this));
  }

  isTimeChanged() {
    return this.expiresAt !== this.expiresAtLoaded;
  }

  isAlmostExpired() {
    return (!!this.maxAge && (this.expiresAt! - Date.now()) < this.maxAge / 2);
  }

  isExpired() {
    return this.expiresAt && this.expiresAt < Date.now();
  }

  refresh() {
    if (this.maxAge) {
      this.expiresAt = this.maxAge + Date.now();
    }
  }

  destroy() {
    this.action = 'destroy';
    delete this.data;
  }

  toJSON() {
    return {
      key: this.key,
      signature: this.signature,
      expiresAt: this.expiresAt,
      maxAge: this.maxAge,
      issuedAt: this.issuedAt,
      data: this.data
    };
  }
}