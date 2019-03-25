import { Util } from '@travetto/base';

export const RAW_SESSION = Symbol('raw_session');
export const RAW_SESSION_PRIV = Symbol('raw_session_priv');

export class Session<T = any> {
  private expiresAtLoaded: number | undefined;
  private hash: number;

  readonly id?: string;

  expiresAt: number | undefined;
  action?: 'create' | 'destroy' | 'modify';
  maxAge?: number;
  signature?: string;
  issuedAt: number;
  payload: T;

  constructor(data: Partial<Session>) {
    this.issuedAt = Date.now();

    for (const k of Object.keys(data) as (keyof Session)[]) {
      this[k] = data[k];
    }
    if (this.maxAge && !this.expiresAt) {
      this.expiresAt = this.maxAge + Date.now();
    }

    this.expiresAtLoaded = this.expiresAt;

    this.hash = Util.naiveHash(JSON.stringify(this));
  }

  isChanged() {
    return this.isTimeChanged() || this.hash !== Util.naiveHash(JSON.stringify(this));
  }

  isTimeChanged() {
    return this.expiresAt !== this.expiresAtLoaded;
  }

  isAlmostExpired() {
    return (!!this.maxAge && (this.expiresAt! - Date.now()) < this.maxAge / 2);
  }

  refresh() {
    if (this.maxAge) {
      this.expiresAt = this.maxAge + Date.now();
    }
  }

  destroy() {
    this.action = 'destroy';
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