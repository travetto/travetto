import { Injectable, Inject } from '@travetto/di';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';
import { Runtime, Util } from '@travetto/runtime';
import { ExpiresAt, Model, ModelExpirySupport, NotFoundError } from '@travetto/model';
import { Text } from '@travetto/schema';
import { AsyncContext } from '@travetto/context';

import { Session } from './session';
import { SessionConfig } from './config';

/**
 * Session model service identifier
 */
export const SessionModelSymbol = Symbol.for('@travetto/rest-session:model');

/**
 * Symbol for accessing the raw session
 */
export const SessionRawSymbol = Symbol.for('@travetto/rest-session:data');

@Model({ autoCreate: false })
export class SessionEntry {
  id: string;
  @Text()
  data: string;
  @ExpiresAt()
  expiresAt?: Date;
  issuedAt: Date;
  maxAge?: number;
}

/**
 * Rest service for supporting the session and managing the session state
 * during the normal lifecycle of requests.
 */
@Injectable()
export class SessionService {

  @Inject()
  config: SessionConfig;

  @Inject()
  context: AsyncContext;

  #modelService: ModelExpirySupport;

  constructor(@Inject(SessionModelSymbol) service: ModelExpirySupport) {
    this.#modelService = service;
  }

  /**
   * Initialize service if none defined
   */
  async postConstruct(): Promise<void> {
    if (isStorageSupported(this.#modelService) && Runtime.dynamic) {
      await this.#modelService.createModel?.(SessionEntry);
    }
  }

  get #session(): Session | undefined {
    return this.context.get<Session>(SessionRawSymbol);
  }

  set #session(v: Session | undefined) {
    this.context.set(SessionModelSymbol, v);
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
        data: JSON.parse(Buffer.from(record.data, 'base64').toString('utf8'))
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
   * @returns Session if it needs to be encoded
   * @returns null if it needs to be removed
   * @returns undefined if nothing should happen
   */
  async persist(): Promise<Session | undefined | null> {
    const session = this.#session;

    // If missing or new and no data
    if (!session || (session.action === 'create' && session.isEmpty())) {
      return;
    }

    // If not destroying, write to response, and store in cache source
    if (session.action !== 'destroy') {
      if (this.config.rolling || (this.config.renew && session.isAlmostExpired())) {
        session.refresh();
      }

      // If expiration time has changed, send new session information
      if (session.action === 'create' || session.isChanged()) {
        await this.#modelService.upsert(SessionEntry, SessionEntry.from({
          ...session,
          data: Buffer.from(JSON.stringify(session.data)).toString('base64')
        }));
        return session;
      }
      // If destroying
    } else if (session.id) { // If destroy and id
      await this.#modelService.delete(SessionEntry, session.id).catch(() => { });
      return null;
    }
  }

  /**
   * Get or recreate session
   */
  get(): Session {
    const existing = this.#session;
    return this.#session =
      (existing?.action === 'destroy' ? undefined : existing) ??
      new Session({ action: 'create', data: {}, id: Util.uuid(), maxAge: this.config.maxAge });
  }

  /**
   * Load from request
   */
  async load(fetchId: () => Promise<string | undefined> | string | undefined): Promise<Session | undefined> {
    if (!this.#session) {
      const id = await fetchId();
      if (id) {
        this.#session = await this.#load(id);
      }
    }
    return this.#session;
  }
}