import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';

import { SessionEncoder } from './encoder';
import { Session } from '../types';
import { SessionConfig } from '../config';

/**
 * Uses cookies for maintaining the session coherency with the user.
 * Primarily encode the user identifier, but relies on cookie behavior for
 * encoding the expiry time.
 */
@Injectable({ target: CookieEncoder })
export class CookieEncoder extends SessionEncoder {

  @Inject()
  config: SessionConfig;

  async encode(req: Request, res: Response, session: Session<any> | null): Promise<void> {
    if (session && session.data) {
      res.cookies.set(this.config.keyName, session.key, {
        maxAge: !session.expiresAt ? -1 : undefined, // Session cookie by default
        expires: session.expiresAt ? new Date(session.expiresAt) : undefined
      });
    } else if (req.cookies.get(this.config.keyName)) { // If cookie present, clear out
      res.cookies.set(this.config.keyName, null, {
        maxAge: 0,
      });
    }
    return;
  }

  async decode(req: Request): Promise<string | Session | undefined> {
    const cookie = req.cookies.get(this.config.keyName);
    return cookie as string;
  }
}