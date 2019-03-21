import { AuthContext } from '@travetto/auth';
import { Request, Response, RestInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';

import { AuthContextStore } from './types';

import * as session from 'express-session';

export class SessionAuthInterceptor extends RestInterceptor {

  private sess: ReturnType<typeof session>;

  constructor(config: any) {
    super();
    this.sess = session(config);
  }

  async intercept(req: Request, res: Response) {
    this.sess(req as any, res as any, () => { });
  }
}

@Injectable()
export class SessionAuthContextStore extends AuthContextStore {

  async refresh(request: Request, response: Response, context: AuthContext): Promise<void> {
    this.store(request, response, context);
  }

  async store(request: Request, response: Response, context: AuthContext): Promise<void> {

    request.session.context = context;
  }

  async load(request: Request): Promise<AuthContext | undefined> {
    return request.session.context;
  }
}