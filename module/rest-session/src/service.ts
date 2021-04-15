import { Injectable, Inject } from '@travetto/di';
import { AppError, Util } from '@travetto/base';
import { isExpirySupported, isStorageSupported } from '@travetto/model/src/internal/service/common';
import { EnvUtil } from '@travetto/boot';
import { ExpiresAt, Model, ModelCrudSupport, NotFoundError } from '@travetto/model';
import { Text } from '@travetto/schema';
import { Request, Response } from '@travetto/rest';
import { ValueAccessor } from '@travetto/rest/src/internal/accessor';

import { Session } from './session';
import { SessionConfig } from './config';

export const SessionModelSym = Symbol.for('@trv:rest-session/model');

/**
 * Symbol for accessing the raw session
 */
const SessionSym = Symbol.for('@trv:rest-session/data');

/**
 * Declare the session on the request
 */
declare global {
  interface TravettoRequest {
    [SessionSym]: Session;
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

  #accessor: ValueAccessor;

  @Inject()
  config: SessionConfig;

  @Inject(SessionModelSym)
  modelService: ModelCrudSupport;

  /**
   * Initialize service if none defined
   */
  async postConstruct() {
    if (!isExpirySupported(this.modelService)) {
      throw new AppError(`Model service must provide expiry support, ${this.modelService.constructor.name} does not.`);
    }
    if (isStorageSupported(this.modelService)) {
      if (!EnvUtil.isReadonly()) {
        await this.modelService.createModel?.(SessionEntry);
      }
    }

    this.#accessor = new ValueAccessor(this.config.keyName, this.config.transport);
  }

  /**
   * Load session by id
   * @returns Session if valid
   */
  async #load(id: string): Promise<Session | undefined> {
    try {
      const record = await this.modelService.get(SessionEntry, id);

      const session = new Session({
        ...record,
        data: JSON.parse(Buffer.from(record.data, 'base64').toString('utf8'))
      });

      // Validate session
      if (session.isExpired()) {
        await this.modelService.delete(SessionEntry, session.id).catch(() => { });
        return new Session({ action: 'destroy' });
      } else {
        return session;
      }
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        throw e; // If not a not found error, throw
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
    if (!session) {
      return;
    }

    // If not destroying, write to response, and store in cache source
    if (session.action !== 'destroy') {
      if (session.action === 'create') {
        const issuedAt = session?.issuedAt ?? Date.now();
        session = new Session({ id: Util.uuid(), issuedAt, maxAge: this.config.maxAge, data: session.data });
        session.refresh();
      } else if (this.config.rolling || (this.config.renew && session.isAlmostExpired())) {
        session.refresh();
      }

      // If expiration time has changed, send new session information
      if (session.isChanged()) {
        await this.modelService.upsert(SessionEntry, SessionEntry.from({
          ...session,
          data: Buffer.from(JSON.stringify(session.data)).toString('base64')
        }));
        return session;
      }
      // If destroying
    } else if (session.id) { // If destroy and id
      await this.modelService.delete(SessionEntry, session.id).catch(() => { });
      return null;
    }
  }

  /**
   * Get or recreate session
   */
  ensureCreated(req: Request) {
    if (!(SessionSym in req) || req[SessionSym].action === 'destroy') {
      req[SessionSym] = new Session({ action: 'create', data: {} });
    }
    return req[SessionSym];
  }

  /**
   * Load from request
   */
  async readRequest(req: Request) {
    if (!req[SessionSym]) {
      const id = req.auth?.details?.sessionId ?? req.auth?.id ?? this.#accessor.readValue(req);
      if (id) {
        req[SessionSym] = (await this.#load(id))!;
      }
    }
  }

  /**
   * Store to response
   */
  async writeResponse(req: Request, res: Response) {
    const value = await this.#store(req[SessionSym]);
    if (value === null) {
      // Send updated info only if expiry changed
      this.#accessor.writeValue(res, null, { expires: new Date() });
    } else if (value?.isTimeChanged()) {
      this.#accessor.writeValue(res, value.id, { expires: value.expiresAt });
    }
  }
}