import { Injectable, Inject } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { Util } from '@travetto/base';

import { SessionSym } from './internal/types';
import { Session } from './types';
import { SessionConfig } from './config';
import { SessionProvider } from './provider/types';

/**
 * Rest service for supporting the session and managing the session state
 * during the normal lifecycle of requests.
 */
@Injectable()
export class RestSessionService {

  @Inject()
  config: SessionConfig;

  /**
   * Session store for how to send/receive session data
   */
  @Inject()
  provider: SessionProvider;

  /**
   * Destroy a session given a request
   */
  async destroy(req: Request) {
    req.session.destroy();
  }

  /**
   * Load session data from the request
   */
  async read(req: Request, res: Response) {
    const session = await this.provider.decode(req);

    // Validate session, and attach to request
    if (session) {
      if (!session.isExpired()) { // Time has not passed
        req[SessionSym] = session;
      } else {
        if (this.provider.delete) {
          await this.provider.delete(req, res, session.id);
        }
        req[SessionSym] = new Session({ action: 'destroy' });
      }
    }
  }

  /**
   * Write session information to response
   */
  async persist(req: Request, res: Response) {

    let session: Session | undefined = req[SessionSym]; // Do not create automatically

    if (!session) {
      return;
    }

    // If not destroying, write to response, and store in cache source
    if (session.action !== 'destroy') {
      if (session.action === 'create') {
        session = new Session({
          id: Util.uuid(),
          issuedAt: session?.issuedAt ?? Date.now(),
          maxAge: this.config.maxAge,
          data: session.data
        });
        session.refresh();
      } else if (this.config.rolling || (this.config.renew && session.isAlmostExpired())) {
        session.refresh();
      }

      // If expiration time has changed, send new session information
      if (session.isChanged()) {
        await this.provider.encode(req, res, session);
      }
      // If destroying
    } else if (session.id) { // If destroy and id
      if (this.provider.delete) {
        await this.provider.delete(req, res, session.id);
      }
      await this.provider.encode(req, res, null);
    }
  }

  /**
   * Configure request and provide controlled access to the raw session
   */
  configure(req: Request) {
    Object.defineProperties(req, {
      session: {
        get(this: Request) {
          if (!(SessionSym in this) || this[SessionSym].action === 'destroy') {
            this[SessionSym] = new Session({ action: 'create', data: {} });
          }
          return this[SessionSym];
        },
        enumerable: true,
        configurable: false
      }
    });
  }
}