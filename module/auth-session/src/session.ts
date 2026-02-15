import { type AnyMap, castKey, castTo, JSONUtil } from '@travetto/runtime';


/**
 * @concrete
 */
export interface SessionData extends AnyMap { }

/**
 * Full session object, with metadata
 */
export class Session<T extends SessionData = SessionData> {
  /**
   * The expiry time when the session was loaded
   */
  #expiresAtLoaded: Date | undefined;
  /**
   * The payload of the session at load
   */
  #payload: string;
  /**
   * The session identifier
   */
  readonly id: string;
  /**
   * Session signature
   */
  readonly signature?: string;

  /**
   * Session initial issue timestamp
   */
  issuedAt: Date;
  /**
   * Expires at time
   */
  expiresAt: Date | undefined;
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
    this.issuedAt = new Date();

    // Overwrite with data
    Object.assign(this, data);

    // Mark the expiry load time
    this.#expiresAtLoaded = this.expiresAt ?? new Date();

    // Hash the session as it stands
    this.#payload = JSONUtil.toUTF8(this);
  }

  /**
   * Get session value
   */
  getValue<V>(key: string): V | undefined {
    return this.data && key in this.data ? this.data[key] : undefined;
  }

  /**
   * Set session value
   */
  setValue<V>(key: string, value: V): void {
    const data = (this.data ??= castTo({}))!;
    data[castKey<T>(key)] = castTo(value);
  }

  /**
   * Determine if session has changed
   */
  isChanged(): boolean {
    return this.isTimeChanged() || this.#payload !== JSONUtil.toUTF8(this);
  }

  /**
   * Determine if the expiry time has changed
   */
  isTimeChanged(): boolean {
    return this.expiresAt !== undefined && this.expiresAt !== this.#expiresAtLoaded;
  }

  /**
   * See if the session is truly expired
   */
  isExpired(): boolean {
    return !!this.expiresAt && this.expiresAt.getTime() < Date.now();
  }

  /**
   * See if session is empty, has any data been written
   */
  isEmpty(): boolean {
    return !Object.keys(this.data ?? {}).length;
  }

  /**
   * Mark the session for destruction, delete the data
   */
  destroy(): void {
    this.action = 'destroy';
    delete this.data;
  }

  /**
   * Serialize the session
   */
  toJSON(): unknown {
    return {
      id: this.id,
      signature: this.signature,
      expiresAt: this.expiresAt?.getTime(),
      issuedAt: this.issuedAt?.getTime(),
      data: this.data
    };
  }
}