import { Injectable, Inject } from '@travetto/di';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';
import { Runtime, Util } from '@travetto/runtime';
import { ModelExpirySupport, NotFoundError } from '@travetto/model';
import { AsyncContext, AsyncContextValue } from '@travetto/context';
import { AuthContext, AuthenticationError } from '@travetto/auth';

import { Session } from './session';
import { SessionEntry, SessionModelSymbol } from './model';

/**
 * Rest service for supporting the session and managing the session state
 * during the normal lifecycle of requests.
 */
@Injectable()
export class SessionService {

  @Inject()
  context: AsyncContext;

  @Inject()
  auth: AuthContext;

  #modelService: ModelExpirySupport;

  #session = new AsyncContextValue<Session>(this);

  constructor(@Inject(SessionModelSymbol) service: ModelExpirySupport) {
    this.#modelService = service;
  }

  /**
   * Disconnect active session
   */
  clear(): void {
    this.#session.set(undefined);
  }

  /**
   * Initialize service if none defined
   */
  async postConstruct(): Promise<void> {
    if (isStorageSupported(this.#modelService) && Runtime.dynamic) {
      await this.#modelService.createModel?.(SessionEntry);
    }
  }

  /**
   * Load session by id
   * @returns Session if valid
   */
  async #load(id: string): Promise<Session | undefined> {
    try {
      const record = await this.#modelService.get(SessionEntry, id);

      const session = new Session({
        ...record,
        data: Util.decodeSafeJSON(record.data)
      });

      // Validate session
      if (session.isExpired()) {
        await this.#modelService.delete(SessionEntry, session.id).catch(() => { });
        return new Session({ action: 'destroy' });
      } else {
        return session;
      }
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err; // If not a not found error, throw
      }
    }
  }

  /**
   * Persist session
   */
  async persist(): Promise<void> {
    const session = this.#session.get();

    // If missing or new and no data
    if (!session || (session.action === 'create' && session.isEmpty())) {
      return;
    }

    const p = this.auth.principal;

    // If not destroying, write to response, and store in cache source
    if (session.action !== 'destroy') {
      session.expiresAt = p?.expiresAt;
      session.issuedAt = p?.issuedAt ?? new Date();

      // If expiration time has changed, send new session information
      if (session.action === 'create' || session.isChanged()) {
        await this.#modelService.upsert(SessionEntry, SessionEntry.from({
          ...session,
          data: Util.encodeSafeJSON(session.data)
        }));
      }
      // If destroying
    } else if (session.id) { // If destroy and id
      await this.#modelService.delete(SessionEntry, session.id).catch(() => { });
    }
  }

  /**
   * Get or recreate session
   */
  getOrCreate(): Session {
    const principal = this.auth.principal;
    if (!principal) {
      throw new AuthenticationError('Unable to establish session without first authenticating');
    }
    const existing = this.#session.get();
    const val = (existing?.action === 'destroy' ? undefined : existing) ??
      new Session({
        id: principal.sessionId,
        expiresAt: principal.expiresAt,
        issuedAt: principal.issuedAt,
        action: 'create',
        data: {},
      });
    this.#session.set(val);
    return val;
  }

  /**
   * Get session if defined
   */
  get(): Session | undefined {
    return this.#session.get();
  }

  /**
   * Load from request
   */
  async load(): Promise<Session | undefined> {
    if (!this.#session.get()) {
      const principal = this.auth.principal;
      if (principal?.sessionId) {
        this.#session.set(await this.#load(principal.sessionId));
      }
    }
    return this.#session.get();
  }

  destroy(): void {
    this.get()?.destroy();
    this.clear();
  }
}