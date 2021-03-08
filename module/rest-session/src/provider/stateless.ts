import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { AppManifest } from '@travetto/base';

import { SessionProvider } from './types';
import { Session } from '../types';
import { SessionConfig } from '../config';
import { EncodeUtil } from './util';

/**
 * Allows for transparent session behavior, sending the full session in the headers.
 *
 * Signed cookies provide tampering protection, where as every other avenue
 */
@Injectable()
export class StatelessSessionProvider implements SessionProvider {

  @Inject()
  config: SessionConfig;

  postConstruct() {
    if (this.config.sign === false && AppManifest.prod) {
      console.error('Stateless support relies on full disclosure of state information.');
      console.error('By not signing the state, the user has full ability to override the state remotely');
    }
  }

  async sessionToText(session: Session): Promise<string> {
    return Buffer.from(JSON.stringify(session.toJSON())).toString('base64');
  }

  async textToSession(text: string): Promise<Session> {
    const parsed = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));

    if (parsed.expiresAt) {
      parsed.expiresAt = new Date(parsed.expiresAt);
    }
    if (parsed.issuedAt) {
      parsed.issuedAt = new Date(parsed.issuedAt);
    }

    return new Session(parsed);
  }

  async encode(req: Request, res: Response, session: Session | null): Promise<void> {
    if (session) {
      EncodeUtil.putValue(res, this.config, session, await this.sessionToText(session));
    } else if (EncodeUtil.canDelete(req, this.config)) {
      EncodeUtil.putValue(res, this.config, null);
    }
    return;
  }

  async decode(req: Request): Promise<Session | undefined> {
    const payload = EncodeUtil.getValue(req, this.config);
    if (payload) {
      return await this.textToSession(payload);
    }
  }
}