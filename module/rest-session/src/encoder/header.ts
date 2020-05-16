import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';

import { SessionEncoder } from './encoder';
import { Session } from '../types';
import { SessionConfig } from '../config';

/**
 * Uses consistent headers back and forth for maintaining the session
 * coherency with the user.  Relies on a session identifier as the storage
 * mechanism.
 */
@Injectable({ target: HeaderEncoder })
export class HeaderEncoder extends SessionEncoder {

  @Inject()
  config: SessionConfig;

  async encode(req: Request, res: Response, session: Session<any> | null): Promise<void> {
    if (session) {
      res.setHeader(this.config.keyName, session.key);
    }
    return;
  }

  async decode(req: Request): Promise<string | Session | undefined> {
    return req.header(this.config.keyName) as string;
  }
}