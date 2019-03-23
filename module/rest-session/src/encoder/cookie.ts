import { Request, Response } from '@travetto/rest';

import { SessionEncoder } from './encoder';
import { Session } from '../types';
import { Inject } from '../../../di';
import { SessionEncoderConfig } from './config';

export class CookieEncoder extends SessionEncoder {
  @Inject()
  config: SessionEncoderConfig;

  async encode(req: Request, res: Response, session: Session<any>): Promise<void> {
    res.cookies.set(this.config.keyName, session.id, {
      expires: new Date(session.expiresAt),
      httpOnly: true,
      signed: this.config.sign,
    });
    return;
  }

  async decode(req: Request): Promise<string | Session | undefined> {
    const cookie = req.cookies.get(this.config.keyName, { signed: this.config.sign });
    return cookie as string;
  }
}