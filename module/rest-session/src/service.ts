import { Injectable, Inject } from '@travetto/di';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';
import { Runtime, Util } from '@travetto/runtime';
import { ModelExpirySupport, NotFoundError } from '@travetto/model';
import { AsyncContext, AsyncContextValue } from '@travetto/context';

import { Session } from './session';
import { SessionConfig } from './config';
import { SessionEntry, SessionModelSymbol } from './model';

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

  #session = new AsyncContextValue<Session>(this);

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
   */
  async persist(onPersist: (value: Session | null) => Promise<void>): Promise<void> {
    const session = this.#session.get();

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
        await onPersist(session);
      }
      // If destroying
    } else if (session.id) { // If destroy and id
      await this.#modelService.delete(SessionEntry, session.id).catch(() => { });
      await onPersist(null);
    }
  }

  /**
   * Get or recreate session
   */
  getOrCreate(): Session {
    const existing = this.#session.get();
    const val = (existing?.action === 'destroy' ? undefined : existing) ??
      new Session({ action: 'create', data: {}, id: Util.uuid(), maxAge: this.config.maxAge });
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
  async load(fetchId: () => Promise<string | undefined> | string | undefined): Promise<Session | undefined> {
    if (!this.#session.get()) {
      const id = await fetchId();
      if (id) {
        this.#session.set(await this.#load(id));
      }
    }
    return this.#session.get();
  }
}