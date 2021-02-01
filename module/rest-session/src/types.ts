import { SystemUtil } from '@travetto/base/src/internal/system';
import { ContextProvider } from '@travetto/rest';

/**
 * @concrete ./internal/types:SessionDataTarget
 */
export interface SessionData {
  [key: string]: any;
}

/**
 * Full session object, with metadata
 */
@ContextProvider((c, req) => req.session)
export class Session<T extends SessionData = SessionData>  {
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
   * Get session value
   */
  getValue<V>(key: string): V | undefined {
    return this.data && key in this.data ? this.data[key] as V : undefined;
  }

  /**
   * Set session value
   */
  setValue<V>(key: string, value: V): void {
    this.data = this.data || {} as T;
    (this.data as Record<string, unknown>)[key] = value;
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
    return this.expiresAt !== undefined && this.expiresAt !== this.expiresAtLoaded;
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