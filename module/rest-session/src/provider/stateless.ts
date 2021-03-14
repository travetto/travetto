import { Request, Response } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { AppManifest } from '@travetto/base';
import { ValueAccessor } from '@travetto/rest/src/internal/accessor';

import { SessionProvider } from './types';
import { Session } from '../types';
import { SessionConfig } from '../config';

/**
 * Allows for transparent session behavior, sending the full session in the headers.
 *
 * Signed cookies provide tampering protection, where as every other avenue
 */
@Injectable()
export class StatelessSessionProvider implements SessionProvider {

  @Inject()
  config: SessionConfig;

  accessor: ValueAccessor;

  postConstruct() {
    if (this.config.sign === false && AppManifest.prod) {
      console.error('Stateless support relies on full disclosure of state information.');
      console.error('By not signing the state, the user has full ability to override the state remotely');
    }
    this.accessor = new ValueAccessor(this.config.keyName, this.config.transport);
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
      this.accessor.writeValue(res, await this.sessionToText(session), { expires: session?.expiresAt });
    } else {
      this.accessor.writeValue(res, null, { expires: new Date() });
    }
    return;
  }

  async decode(req: Request): Promise<Session | undefined> {
    const payload = this.accessor.readValue(req);
    if (payload) {
      return await this.textToSession(payload);
    }
  }
}