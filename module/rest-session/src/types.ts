import { Util } from '@travetto/base';

export const RAW_SESSION = Symbol('raw_session');
export const RAW_SESSION_PRIV = Symbol('raw_session_priv');

export class Session<T = any> {
  private expiresAtLoaded: Date | undefined;
  private hash: number;

  readonly id?: string;

  expiresAt: Date | undefined;
  action?: 'create' | 'destroy' | 'modify';
  maxAge?: number;
  signature?: string;
  issuedAt: Date;
  payload: T;

  constructor(data: Partial<Session>) {
    this.issuedAt = new Date();

    for (const k of Object.keys(data) as (keyof Session)[]) {
      this[k] = data[k];
    }

    if (!(this.expiresAt instanceof Date)) {
      this.expiresAt = new Date(this.expiresAt as any);
    }

    if (!(this.issuedAt instanceof Date)) {
      this.issuedAt = new Date(this.issuedAt);
    }

    this.expiresAtLoaded = this.expiresAt || new Date();

    if (this.maxAge && !this.expiresAt) {
      this.expiresAt = new Date(this.maxAge + Date.now());
    }

    this.hash = Util.naiveHash(JSON.stringify(this));
  }

  isChanged() {
    return this.isTimeChanged() || this.hash !== Util.naiveHash(JSON.stringify(this));
  }

  isTimeChanged() {
    return this.expiresAt !== this.expiresAtLoaded;
  }

  isAlmostExpired() {
    return (!!this.maxAge && (this.expiresAt!.getTime() - Date.now()) < this.maxAge / 2);
  }

  refresh() {
    if (this.maxAge) {
      this.expiresAt = new Date(this.maxAge + Date.now());
    }
  }

  destroy() {
    this.action = 'destroy';
    delete this.payload;
  }

  toJSON() {
    return {
      id: this.id,
      signature: this.signature,
      expiresAt: this.expiresAt,
      maxAge: this.maxAge,
      issuedAt: this.issuedAt,
      payload: this.payload
    };
  }
}