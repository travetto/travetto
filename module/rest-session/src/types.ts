import { SystemUtil } from '@travetto/base';
import { ContextProvider } from '@travetto/rest';

@ContextProvider((c, req) => req!.session.data)
export class SessionData {
  [key: string]: any;
}

@ContextProvider((c, req) => req!.session)
export class Session<T = any> {
  private expiresAtLoaded: Date | undefined;
  private hash: number;

  readonly id?: string;

  readonly maxAge?: number;
  readonly signature?: string;
  readonly issuedAt: Date;

  expiresAt: Date | undefined;
  action?: 'create' | 'destroy' | 'modify';
  data: T;

  constructor(data: Partial<Session>) {
    this.issuedAt = new Date();

    // Overwrite with data
    Object.assign(this, data);

    if (this.expiresAt && !(this.expiresAt instanceof Date)) {
      this.expiresAt = new Date(this.expiresAt as any);
    }

    if (!(this.issuedAt instanceof Date)) {
      this.issuedAt = new Date(this.issuedAt);
    }

    this.expiresAtLoaded = this.expiresAt || new Date();

    if (this.maxAge && !this.expiresAt) {
      this.expiresAt = new Date(this.maxAge + Date.now());
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
    return (!!this.maxAge && (this.expiresAt!.getTime() - Date.now()) < this.maxAge / 2);
  }

  isExpired() {
    return this.expiresAt && this.expiresAt.getTime() < Date.now();
  }

  refresh() {
    if (this.maxAge) {
      this.expiresAt = new Date(this.maxAge + Date.now());
    }
  }

  destroy() {
    this.action = 'destroy';
    delete this.data;
  }

  toJSON() {
    return {
      id: this.id,
      signature: this.signature,
      expiresAt: this.expiresAt,
      maxAge: this.maxAge,
      issuedAt: this.issuedAt,
      data: this.data
    };
  }
}