import { SystemUtil } from '@travetto/base/src/internal/system';
import { ContextProvider } from '@travetto/rest';
import { CacheEntry } from '@travetto/cache';

/**
 * Session data, will basically be a key/value map
 */
@ContextProvider((c, req) => req!.session.data)
export class SessionData {
  [key: string]: any;
}

/**
 * Full session object, with metadata
 */
@ContextProvider((c, req) => req!.session)
export class Session<T = any> implements CacheEntry {
  /**
   * The expiry time when the session was loaded
   */
  private expiresAtLoaded: number | undefined;
  /**
   * The hash of the session at load
   */
  private hash: number;
  /**
   * The session key name
   */
  readonly key: string;
  /**
   * Session max age in ms
   */
  readonly maxAge?: number;
  /**
   * Session signature
   */
  readonly signature?: string;
  /**
   * Session initial issue timestamp
   */
  readonly issuedAt: number;

  /**
   * Expires at time
   */
  expiresAt: number | undefined;
  /**
   * What action should be taken against the session
   */
  action?: 'create' | 'destroy' | 'modify';
  /**
   * The session data
   */
  data: T | undefined;

  /**
   * Create a new Session object given a partial version of itself
   */
  constructor(data: Partial<Session>) {
    // Mark the issued at as now
    this.issuedAt = Date.now();

    // Overwrite with data
    Object.assign(this, data);

    // Mark the expiry load time
    this.expiresAtLoaded = this.expiresAt ?? Date.now();

    // Mark expiry time
    if (this.maxAge && !this.expiresAt) {
      this.expiresAt = this.maxAge + Date.now();
    }

    // Hash the session as it stands
    this.hash = SystemUtil.naiveHash(JSON.stringify(this));
  }

  /**
   * Determine if session has changed
   */
  isChanged() {
    return this.isTimeChanged() || this.hash !== SystemUtil.naiveHash(JSON.stringify(this));
  }

  /**
   * Determine if the expiry time has changed
   */
  isTimeChanged() {
    return this.expiresAt !== this.expiresAtLoaded;
  }

  /**
   * See if the session is nearly expired
   */
  isAlmostExpired() {
    return (!!this.maxAge && (this.expiresAt! - Date.now()) < this.maxAge / 2);
  }

  /**
   * See if the session is truly expired
   */
  isExpired() {
    return this.expiresAt && this.expiresAt < Date.now();
  }

  /**
   * Refresh the session expiration time
   */
  refresh() {
    if (this.maxAge) {
      this.expiresAt = this.maxAge + Date.now();
    }
  }

  /**
   * Mark the session for destruction, delete the data
   */
  destroy() {
    this.action = 'destroy';
    delete this.data;
  }

  /**
   * Serialize the session
   */
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