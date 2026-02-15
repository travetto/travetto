import { Injectable, Inject } from '@travetto/di';
import { JSONUtil } from '@travetto/runtime';
import { type ModelExpirySupport, NotFoundError } from '@travetto/model';
import type { AuthContext, AuthService } from '@travetto/auth';

import { Session } from './session.ts';
import { SessionEntry, SessionModelSymbol } from './model.ts';
import type { SessionContext } from './context.ts';

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
   * Load session by id
   * @returns Session if valid
   */
  async #load(id: string): Promise<Session | undefined> {
    try {
      const record = await this.#modelService.get(SessionEntry, id);

      const session = new Session({
        ...record,
        data: JSONUtil.fromBase64(record.data)
      });

      // Validate session
      if (session.isExpired()) {
        await this.#modelService.delete(SessionEntry, session.id).catch(() => { });
        return new Session({ action: 'destroy' });
      } else {
        return session;
      }
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error; // If not a not found error, throw
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
    this.authService.manageExpiry(this.authContext.principal);

    const principal = this.authContext.principal;

    // If not destroying, write to response, and store
    if (principal && session.action !== 'destroy') {
      session.expiresAt = principal.expiresAt;
      session.issuedAt = principal.issuedAt!;

      // If expiration time has changed, send new session information
      if (session.action === 'create' || session.isChanged()) {
        await this.#modelService.upsert(SessionEntry, SessionEntry.from({
          ...session,
          data: JSONUtil.toBase64(session.data)
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