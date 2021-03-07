import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { ExpiresAt, MemoryModelConfig, MemoryModelService, Model, ModelCrudSupport } from '@travetto/model';
import { Text } from '@travetto/schema';
import { AppError, AppManifest } from '@travetto/base';
import { isExpirySupported, isStorageSupported } from '@travetto/model/src/internal/service/common';
import { EnvUtil } from '@travetto/boot';

import { SessionProvider } from './types';
import { Session } from '../types';
import { SessionConfig } from '../config';
import { EncodeUtil } from './util';

export const SessionOpaqueSym = Symbol.for('@trv:session/opaque');

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
 * Primarily encode the user identifier, but relies on cookie behavior for
 * encoding the expiry time, when transport is set to cookie.
 */
@Injectable({ primary: true })
export class OpaqueSessionProvider implements SessionProvider {

  @Inject()
  config: SessionConfig;

  /**
   * Cache for storing the session
   */
  @Inject({ qualifier: SessionOpaqueSym, optional: true })
  modelService: ModelCrudSupport;

  /**
   * Initialize service if none defined
   */
  async postConstruct() {
    if (this.modelService === undefined) {
      if (!AppManifest.prod) {
        this.modelService = new MemoryModelService(new MemoryModelConfig());
        console.warn('No session cache defined, falling back to in-memory cache. This is not intended for production session use');
      } else {
        throw new AppError('In-memory cache is not intended for production session use', 'general');
      }
    } else if (!isExpirySupported(this.modelService)) {
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
        data: JSON.stringify(session.data),
      }));

      // Send updated info only if expiry changed
      if (session.isTimeChanged()) {
        EncodeUtil.putValue(res, this.config, session, x => x.id);
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
        data: JSON.parse(record.data)
      });
    }
  }
}