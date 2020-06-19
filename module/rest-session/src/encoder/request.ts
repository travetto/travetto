import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';

import { SessionEncoder } from './encoder';
import { Session } from '../types';
import { SessionConfig } from '../config';

/**
 * Uses request for maintaining the session coherency with the user.
 * Primarily encode the user identifier, but relies on cookie behavior for
 * encoding the expiry time, when transport is set to cookie.
 */
@Injectable()
export class RequetSessionEncoder extends SessionEncoder {

  @Inject()
  config: SessionConfig;

  async encode(req: Request, res: Response, session: Session<any> | null): Promise<void> {
    if (session && session.data) {
      if (this.config.transport === 'cookie') {
        res.cookies.set(this.config.keyName, session.key, {
          maxAge: !session.expiresAt ? -1 : undefined, // Session cookie by default
          expires: session.expiresAt ? new Date(session.expiresAt) : undefined
        });
      } else {
        res.setHeader(this.config.keyName, session.key);
      }
    } else if (this.config.transport === 'cookie' && req.cookies.get(this.config.keyName)) { // If cookie present, clear out
      res.cookies.set(this.config.keyName, null, {
        maxAge: 0,
      });
    }
    return;
  }

  async decode(req: Request): Promise<string | Session | undefined> {
    if (this.config.transport === 'cookie') {
      return req.cookies.get(this.config.keyName);
    } else {
      return req.header(this.config.keyName) as string;
    }
  }
}