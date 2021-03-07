import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';

import { SessionProvider } from './types';
import { Session } from '../types';
import { SessionConfig } from '../config';
import { EncodeUtil } from './util';

/**
 * Allows for transparent session behavior, sending the session in the headers
 * to achieve full statelessness
 */
@Injectable()
export class StatelessSessionProvider implements SessionProvider {

  @Inject()
  config: SessionConfig;

  async encode(req: Request, res: Response, session: Session | null): Promise<void> {
    if (session) {
      EncodeUtil.putValue(res, this.config, session, x => JSON.stringify(x.toJSON()));
    } else if (EncodeUtil.canDelete(req, this.config)) {
      EncodeUtil.putValue(res, this.config, null);
    }
    return;
  }

  async decode(req: Request): Promise<Session | undefined> {
    const payload = EncodeUtil.getValue(req, this.config);
    if (payload) {
      return new Session(JSON.parse(payload));
    }
  }
}