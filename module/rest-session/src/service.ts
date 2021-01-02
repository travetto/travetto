import { Injectable, Inject } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { EnvUtil } from '@travetto/boot';
import { CacheService } from '@travetto/cache';
import { Util, AppError } from '@travetto/base';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';

import { SessionSym } from './internal/types';
import { Session } from './types';
import { SessionConfig } from './config';
import { SessionEncoder } from './encoder/types';

export const SessionCacheSym = Symbol.for('@trv:session/cache');

/**
 * Rest service for supporting the session and managing the session state
 * during the normal lifecycle of requests.
 */
@Injectable()
export class RestSessionService {

  @Inject()
  config: SessionConfig;

  /**
   * Encoder for how to send/receive session from the user
   */
  @Inject()
  encoder: SessionEncoder;

  /**
   * Cache for storing the session
   */
  @Inject({ qualifier: SessionCacheSym, optional: true })
  cacheSource: CacheService;

  /**
   * Initialize store if none defined
   */
  async postConstruct() {
    if (this.cacheSource === undefined) {
      this.cacheSource = new CacheService(new MemoryModelService(new MemoryModelConfig()));
      if (!EnvUtil.isProd()) {
        console.warn('No session cache defined, falling back to in-memory cache. This is not intended for production session use');
      } else {
        throw new AppError('In-memory cache is not intended for production session use', 'general');
      }
    }
  }

  /**
   * Validate a given session, and ensure it exists
   */
  async validate(session: Session) {
    if (session.isExpired()) { // Time has passed
      return false;
    }
    return !!(await this.cacheSource.getOptional(session.key));
  }

  /**
   * Destroy a session given a request
   */
  async destroy(req: Request) {
    req.session.destroy();
  }

  /**
   * Load session data from the request
   */
  async loadFromExternal(req: Request) {
    const sessionKey = await this.encoder.decode(req);
    let session: Session | undefined;

    // Read session as an id or as a full payload
    if (sessionKey) {
      if (typeof sessionKey === 'string') {
        session = await this.cacheSource.get(sessionKey);
      } else if ('id' in sessionKey) { // Is a session object
        session = sessionKey;
      }
    }

    // Validate session, and attach to request
    if (session) {
      session = session instanceof Session ? session : new Session(session);

      if (await this.validate(session)) {
        req[SessionSym] = session;
      } else {
        await this.cacheSource.delete(session.key); // Invalid session, nuke it
        req[SessionSym] = new Session({ action: 'destroy' });
      }
    }
  }

  /**
   * Write session information to response
   */
  async storeToExternal(req: Request, res: Response) {

    let session: Session | undefined = req[SessionSym]; // Do not create automatically

    if (!session) {
      return;
    }

    // If not destroying, write to response, and store in cache source
    if (session.action !== 'destroy') {
      if (session.action === 'create') {
        session = new Session({
          key: Util.uuid(),
          issuedAt: session?.issuedAt ?? Date.now(),
          maxAge: this.config.maxAge,
          data: session.data
        });
        session.refresh();
      } else if (this.config.rolling || (this.config.renew && session.isAlmostExpired())) {
        session.refresh();
      }

      // If changed, update
      if (session.isChanged()) {
        await this.cacheSource.set(session.key, session);
      }
      // If expiration time has changed, send new session information
      if (session.isTimeChanged()) {
        await this.encoder.encode(req, res, session);
      }
      // If destroying
    } else if (session.key) { // If destroy and id
      await this.cacheSource.delete(session.key);
      await this.encoder.encode(req, res, null);
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