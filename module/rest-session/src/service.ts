import { Injectable, Inject } from '@travetto/di';
import { Request, Response } from '@travetto/rest';

import { SessionEncoder } from './encoder/encoder';
import { Session } from './types';
import { SessionConfig } from './config';
import { CookieEncoder } from './encoder/cookie';
import { CacheStore, MemoryCacheStore } from '@travetto/cache';
import { Util, Env, AppError } from '@travetto/base';

const SESS = Symbol.for('_trv_session');
export const SESSION_CACHE = Symbol.for('_trv_session_cache');

@Injectable()
// TODO: Document
export class RestSessionService {

  @Inject()
  config: SessionConfig;

  @Inject({ defaultIfMissing: CookieEncoder })
  encoder: SessionEncoder;

  @Inject({ qualifier: SESSION_CACHE, optional: true })
  store: CacheStore<Session>;

  postContruct() {
    if (this.store === undefined) {
      this.store = new MemoryCacheStore<Session>();
      if (!Env.prod) {
        console.warn('MemoryCacheStore is not intended for production session use');
      } else {
        throw new AppError('MemoryCacheStore is not intended for production session use', 'general');
      }
    }
  }

  async validate(session: Session) {
    if (session.isExpired()) { // Time has passed
      return false;
    }
    return !!(await this.store.has(session.key));
  }

  async destroy(req: Request) {
    req.session.destroy();
  }

  async loadFromExternal(req: Request) {
    const sessionKey = await this.encoder.decode(req);
    let session: Session | undefined;

    if (sessionKey) {
      if (typeof sessionKey === 'string') {
        session = await this.store.get(sessionKey);
      } else if ('id' in sessionKey) { // Is a session object
        session = sessionKey;
      }
    }

    if (session) {
      session = session instanceof Session ? session : new Session(session);

      if (await this.validate(session)) {
        (req as any)[SESS] = session;
      } else {
        await this.store.delete(session.key); // Invalid session, nuke it
        (req as any)[SESS] = new Session({ action: 'destroy' });
      }
    }
  }

  async storeToExternal(req: Request, res: Response) {

    let session: Session | undefined = (req as any)[SESS]; // Do not create automatically

    if (!session) {
      return;
    }

    if (session.action !== 'destroy') {
      if (session.action === 'create') {
        session = new Session({
          key: Util.uuid(),
          issuedAt: Date.now(),
          maxAge: this.config.maxAge,
          data: session.data
        });
        session.refresh();
      } else if (this.config.rolling || (this.config.renew && session.isAlmostExpired())) {
        session.refresh();
      }

      if (session.isChanged()) {
        await this.store.set(session.key, session);
      }
      if (session.isTimeChanged()) {
        await this.encoder.encode(req, res, session);
      }
    } else if (session.key) { // If destroy and id
      await this.store.delete(session.key);
      await this.encoder.encode(req, res, null);
    }
  }

  configure(req: Request) {
    Object.defineProperties(req, {
      session: {
        get(this: Request) {
          if (!(SESS in this) || (this as any)[SESS].action === 'destroy') {
            (this as any)[SESS] = new Session({ action: 'create', data: {} });
          }
          return (this as any)[SESS];
        },
        enumerable: true,
        configurable: false
      }
    });
  }
}