import { Injectable, Inject } from '@travetto/di';
import { Runtime, Util } from '@travetto/runtime';
import { ModelExpirySupport, NotFoundError, ModelStorageUtil } from '@travetto/model';
import { AuthContext, AuthService } from '@travetto/auth';

import { Session } from './session';
import { SessionEntry, SessionModelSymbol } from './model';
import { SessionContext } from './context';

/**
 * Service for supporting the session and managing the session state
 */
@Injectable()
export class SessionService {

  @Inject()
  context: SessionContext;

  @Inject()
  authContext: AuthContext;

  @Inject()
  authService: AuthService;

  #modelService: ModelExpirySupport;

  constructor(@Inject(SessionModelSymbol) service: ModelExpirySupport) {
    this.#modelService = service;
  }

  /**
   * Initialize service if none defined
   */
  async postConstruct(): Promise<void> {
    if (ModelStorageUtil.isSupported(this.#modelService) && Runtime.dynamic) {
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
    const session = this.context.get();

    // If missing or new and no data
    if (!session || (session.action === 'create' && session.isEmpty())) {
      return;
    }

    // Ensure latest expiry information before persisting
    await this.authService.manageExpiry(this.authContext.principal);

    const p = this.authContext.principal;

    // If not destroying, write to response, and store
    if (p && session.action !== 'destroy') {
      session.expiresAt = p.expiresAt;
      session.issuedAt = p.issuedAt!;

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
   * Load from principal
   */
  async load(): Promise<Session | undefined> {
    if (!this.context.get()) {
      const principal = this.authContext.principal;
      if (principal?.sessionId) {
        this.context.set(await this.#load(principal.sessionId));
      }
    }
    return this.context.get();
  }
}