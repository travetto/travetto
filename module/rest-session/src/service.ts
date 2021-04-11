import { Injectable, Inject } from '@travetto/di';
import { Util } from '@travetto/base';
import { AppError } from '@travetto/base';
import { isExpirySupported, isStorageSupported } from '@travetto/model/src/internal/service/common';
import { EnvUtil } from '@travetto/boot';
import { ExpiresAt, Model, ModelCrudSupport, NotFoundError } from '@travetto/model';
import { Text } from '@travetto/schema';

import { Session } from './session';
import { SessionConfig } from './config';

export const SessionModelSym = Symbol.for('@trv:rest-session/model');

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
  }

  /**
   * Load session by id
   * @returns Session if valid
   */
  async load(id: string): Promise<Session | undefined> {
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
  async store(session: Session | undefined): Promise<Session | undefined | null> {
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
}

