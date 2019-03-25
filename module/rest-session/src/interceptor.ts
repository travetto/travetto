import { Injectable, Inject } from '@travetto/di';
import { RestInterceptor, Request, Response } from '@travetto/rest';

import { SessionEncoder } from './encoder/encoder';
import { SessionStore } from './store/store';
import { Session, RAW_SESSION, RAW_SESSION_PRIV } from './types';

@Injectable()
export class SessionInterceptor extends RestInterceptor {

  @Inject()
  encoder: SessionEncoder;

  @Inject()
  store: SessionStore;

  async loadFromExternal(req: Request) {
    const sessionKey = await this.encoder.decode(req);
    let session: Session | undefined;
    if (typeof sessionKey === 'string') {
      session = await this.store.load(sessionKey);
    } else if (sessionKey) {
      session = sessionKey;
    }
    if (session) {
      if (await this.store.validate(session)) {
        req[RAW_SESSION_PRIV] = session;
      } else {
        await this.store.destroy(session);
      }
    }
  }

  async storeToExternal(req: Request, res: Response) {

    let session: Session | undefined = req[RAW_SESSION];
    let created = false;

    if (req.session && !req[RAW_SESSION]!.id) {
      session = await this.store.create(req.session);
      created = true;
    } else if (session) {
      await this.store.store(session);
    }
    if (created && session) {
      await this.encoder.encode(req, res, session);
    } else if (!session || !session.payload) {
      await this.encoder.encode(req, res, null);
    }
  }

  modifyRequest(req: Request) {
    Object.defineProperties(req, {
      [RAW_SESSION]: {
        get() {
          this[RAW_SESSION_PRIV] = this[RAW_SESSION_PRIV] || { payload: {} };
          return this[RAW_SESSION_PRIV];
        }
      },
      session: {
        get() { return this[RAW_SESSION]!.payload; },
        set(val: any) { this[RAW_SESSION]!.payload = val; },
        enumerable: true,
        configurable: true
      }
    });
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    try {
      this.modifyRequest(req);
      await this.loadFromExternal(req);
      return await next();
    } finally {
      await this.storeToExternal(req, res);
    }
  }
}