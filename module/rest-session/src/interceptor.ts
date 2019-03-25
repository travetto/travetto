import { Injectable, Inject } from '@travetto/di';
import { RestInterceptor, Request, Response } from '@travetto/rest';

import { SessionEncoder } from './encoder/encoder';
import { SessionStore } from './store/store';
import { Session } from './types';

const RAW_SESSION = Symbol('raw_session');

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
        (req as any)[RAW_SESSION] = session;
      } else {
        await this.store.destroy(session);
      }
    }
  }

  async storeToExternal(req: Request, res: Response) {

    let session: Session | undefined = (req as any)[RAW_SESSION];
    let created = false;

    if (req.session && !(req as any)[RAW_SESSION]!.id) {
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
    Object.defineProperty(req, 'session', {
      get() {
        if (!(req as any)[RAW_SESSION]) {
          (req as any)[RAW_SESSION] = { payload: {} } as any;
        }
        return (req as any)[RAW_SESSION]!.payload;
      },
      set(val: any) {
        if (!(req as any)[RAW_SESSION]) {
          (req as any)[RAW_SESSION] = { payload: {} } as any;
        }
        (req as any)[RAW_SESSION]!.payload = val;
      },
      enumerable: true,
      configurable: true
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