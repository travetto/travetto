import { Injectable, Inject } from '@travetto/di';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';
import { Util } from '@travetto/base';
import { EnvUtil } from '@travetto/boot';
import { ExpiresAt, Model, ModelExpirySupport, NotFoundError } from '@travetto/model';
import { Text } from '@travetto/schema';
import { Request, Response } from '@travetto/rest';

import { Session, SessionData } from './session';
import { SessionConfig } from './config';

/**
 * Session model service identifier
 */
export const SessionModelⲐ = Symbol.for('@trv:rest-session/model');

/**
 * Symbol for accessing the raw session
 */
export const SessionⲐ = Symbol.for('@trv:rest-session/data');

/**
 * Declare the session on the request
 */
declare global {
  interface TravettoRequest {
    [SessionⲐ]: Session;
  }
}

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

  #modelService: ModelExpirySupport;

  constructor(@Inject(SessionModelⲐ, { resolution: 'loose' }) service: ModelExpirySupport) {
    this.#modelService = service;
  }

  /**
   * Initialize service if none defined
   */
  async postConstruct(): Promise<void> {
    if (isStorageSupported(this.#modelService) && EnvUtil.isDynamic()) {
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
   * Store session
   * @returns Session if it needs to be encoded
   * @returns null if it needs to be removed
   * @returns undefined if nothing should happen
   */
  async #store(session: Session | undefined): Promise<Session | undefined | null> {
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
  ensureCreated(req: Request): Session {
    if (req[SessionⲐ]?.action === 'destroy') {
      // @ts-expect-error
      req[SessionⲐ] = undefined;
    }
    return req[SessionⲐ] ??= new Session({ action: 'create', data: {}, id: Util.uuid(), maxAge: this.config.maxAge });
  }

  /**
   * Load from request
   */
  async readRequest(req: Request, id?: string): Promise<void> {
    if (!req[SessionⲐ]) {
      id = this.config.transport === 'cookie' ? req.cookies.get(this.config.keyName) : req.headerFirst(this.config.keyName);
      if (id) {
        req[SessionⲐ] = (await this.#load(id))!;
      }
    }
  }

  /**
   * Store to response
   */
  async writeResponse(res: Response, raw: Session<SessionData>): Promise<void> {
    const value = await this.#store(raw);

    if (value === undefined) {
      return;
    }
    if (value === null) {
      // Send updated info only if expiry changed
      if (this.config.transport === 'cookie') {
        res.cookies.set(this.config.keyName, null, {
          expires: new Date(),
          maxAge: undefined,
        });
      }
    } else {
      if (this.config.transport === 'cookie') {
        if (value.action === 'create' || value.isTimeChanged()) {
          res.cookies.set(this.config.keyName, value.id, {
            expires: value.expiresAt,
            maxAge: undefined,
          });
        }
      } else if (value.action === 'create') {
        res.setHeader(this.config.keyName, value.id);
      }
    }
  }
}