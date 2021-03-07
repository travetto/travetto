// @file-if @travetto/model
import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { ExpiresAt, Model, ModelCrudSupport } from '@travetto/model';
import { Text } from '@travetto/schema';
import { AppError } from '@travetto/base';
import { isExpirySupported, isStorageSupported } from '@travetto/model/src/internal/service/common';
import { EnvUtil } from '@travetto/boot';
import { JSONUtil } from '@travetto/boot/src/internal/json';

import { SessionProvider } from '../provider/types';
import { Session } from '../types';
import { SessionConfig } from '../config';
import { EncodeUtil } from '../provider/util';

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
 * Uses request for maintaining the session coherency with the user.
 */
@Injectable()
export class ModelSessionProvider implements SessionProvider {

  @Inject()
  config: SessionConfig;

  /**
   * Cache for storing the session
   */
  @Inject(SessionModelSym)
  modelService: ModelCrudSupport;

  /**
   * Initialize service if none defined
   */
  async postConstruct() {
    if (!isExpirySupported(this.modelService)) {
      throw new AppError(`Model service must provide expiry support, ${this.modelService.constructor.name} does  not`);
    }
    if (isStorageSupported(this.modelService)) {
      if (!EnvUtil.isReadonly()) {
        await this.modelService.createModel?.(SessionEntry);
      }
    }
  }

  async delete(req: Request, res: Response, id: string) {
    await this.modelService.delete(SessionEntry, id).then(() => true, () => false);
  }

  async encode(req: Request, res: Response, session: Session | null): Promise<void> {
    if (session) {
      // Store update of session
      await this.modelService.upsert(SessionEntry, SessionEntry.from({
        ...session,
        data: Buffer.from(JSON.stringify(session.data)).toString('base64')
      }));

      // Send updated info only if expiry changed
      if (session.isTimeChanged()) {
        EncodeUtil.putValue(res, this.config, session, session.id);
      }
    } else if (EncodeUtil.canDelete(req, this.config)) {
      EncodeUtil.putValue(res, this.config, null);
    }
    return;
  }

  async decode(req: Request): Promise<Session | undefined> {
    const id = EncodeUtil.getValue(req, this.config);
    const record = await this.modelService.get(SessionEntry, id).catch(() => { });

    if (record) {
      return new Session({
        ...record,
        data: JSONUtil.parse(Buffer.from(record.data, 'base64').toString('utf8'))
      });
    }
  }
}