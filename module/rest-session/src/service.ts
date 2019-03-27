import { Injectable, Inject } from '@travetto/di';
import { Request, Response } from '@travetto/rest';

import { SessionEncoder } from './encoder/encoder';
import { SessionStore } from './store/store';
import { Session, RAW_SESSION_PRIV, RAW_SESSION } from './types';
import { SessionConfig } from './config';
import { CookieEncoder } from './encoder/cookie';
import { MemoryStore } from './store/memory';

@Injectable()
export class RestSessionService {

  @Inject()
  config: SessionConfig;

  @Inject({ defaultIfMissing: CookieEncoder })
  encoder: SessionEncoder;

  @Inject({ defaultIfMissing: MemoryStore })
  store: SessionStore;

  async validate(session: Session) {
    if (session.expiresAt && session.expiresAt < Date.now()) { // Time has passed
      return false;
    }
    return await this.store.validate(session);
  }

  async destroy(req: Request) {
    req[RAW_SESSION].destroy();
    delete req.session;
  }

  async loadFromExternal(req: Request) {
    const sessionKey = await this.encoder.decode(req);
    let session: Session | undefined;

    if (sessionKey) {
      if (typeof sessionKey === 'string') {
        session = await this.store.load(sessionKey);
      } else if ('id' in sessionKey) { // Is a session object
        session = sessionKey;
      }
    }

    if (session) {
      session = session instanceof Session ? session : new Session(session);

      if (await this.validate(session)) {
        req[RAW_SESSION_PRIV] = session;
      } else {
        await this.store.destroy(session); // Invalid session, nuke it
        req[RAW_SESSION_PRIV] = new Session({ action: 'destroy' });
      }
    }
  }

  async storeToExternal(req: Request, res: Response) {

    let session: Session | undefined = req[RAW_SESSION_PRIV];

    if (!session) {
      return;
    }

    if (session.action !== 'destroy') {
      if (session.action === 'create') {
        session = await this.store.create(session.payload, this.config.maxAge);
        session.refresh();
      } else if (this.config.rolling || this.config.renew && session.isAlmostExpired()) {
        session.refresh();
      }

      if (session.isChanged()) {
        await this.store.store(session);
      }
      if (session.isTimeChanged()) {
        await this.encoder.encode(req, res, session);
      }
    } else if (session.id) { // If no payload and id
      await this.store.destroy(session);
      await this.encoder.encode(req, res, null);
    }
  }

  configure(req: Request) {
    Object.defineProperties(req, {
      [RAW_SESSION]: {
        get(this: Request) {
          if (!(RAW_SESSION_PRIV in this) || this[RAW_SESSION_PRIV].action === 'destroy') {
            this[RAW_SESSION_PRIV] = new Session({ action: 'create', payload: {} });
          }
          return this[RAW_SESSION_PRIV];
        }
      },
      session: {
        get(this: Request) { return this[RAW_SESSION].payload; },
        set(this: Request, val: any) {
          const sess = this[RAW_SESSION];
          if (!val) {
            sess.destroy();
          } else {
            sess.payload = val;
          }
        },
        enumerable: true,
        configurable: false
      }
    });
  }
}