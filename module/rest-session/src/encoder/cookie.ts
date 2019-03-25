import { Request, Response } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { SessionEncoder } from './encoder';
import { Session } from '../types';
import { SessionEncoderConfig } from './config';

export class CookieEncoder extends SessionEncoder {
  @Inject()
  config: SessionEncoderConfig;

  async encode(req: Request, res: Response, session: Session<any> | null): Promise<void> {
    if (session) {
      res.cookies.set(this.config.keyName, session.id, {
        expires: new Date(session.expiresAt),
        httpOnly: true,
        signed: this.config.sign,
      });
    } else if (req.cookies.get(this.config.keyName)) { // If cookie present, clear out
      res.cookies.set(this.config.keyName, null, {
        signed: this.config.sign,
        httpOnly: true,
        maxAge: 0
      });
    }
    return;
  }

  async decode(req: Request): Promise<string | Session | undefined> {
    const cookie = req.cookies.get(this.config.keyName, { signed: this.config.sign });
    return cookie as string;
  }
}