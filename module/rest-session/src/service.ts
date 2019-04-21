import { Injectable, Inject } from '@travetto/di';
import { Request, ContextParamRegistry, Response } from '@travetto/rest';

import { SessionEncoder } from './encoder/encoder';
import { SessionStore } from './store/store';
import { Session, SessionData } from './types';
import { SessionConfig } from './config';
import { CookieEncoder } from './encoder/cookie';
import { MemoryStore } from './store/memory';

const SESS = Symbol('sess');

@Injectable()
export class RestSessionService {

  @Inject()
  config: SessionConfig;

  @Inject({ defaultIfMissing: CookieEncoder })
  encoder: SessionEncoder;

  @Inject({ defaultIfMissing: MemoryStore })
  store: SessionStore;

  postConstruct() {
    ContextParamRegistry.set(Session, (c, req) => req!.session);
    ContextParamRegistry.set(SessionData, (c, req) => req!.session.data);
  }

  async validate(session: Session) {
    if (session.isExpired()) { // Time has passed
      return false;
    }
    return await this.store.validate(session);
  }

  async destroy(req: Request) {
    req.session.destroy();
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
        (req as any)[SESS] = session;
      } else {
        await this.store.destroy(session); // Invalid session, nuke it
        (req as any)[SESS] = new Session({ action: 'destroy' });
      }
    }
  }

  async storeToExternal(req: Request, res: Response) {

    let session: Session | undefined = (this as any)[SESS]; // Do not create automatically

    if (!session) {
      return;
    }

    if (session.action !== 'destroy') {
      if (session.action === 'create') {
        session = await this.store.create(session.data, this.config.maxAge);
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
    } else if (session.id) { // If destroy and id
      await this.store.destroy(session);
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