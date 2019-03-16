import * as crypto from 'crypto';

import { AuthContext } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { AuthContextStore } from './types';

export class SessionConfig {
  cookieName: string;
  timeout: number;
  secure: boolean;
}

export interface SessionStore {
  get(key: string): any;
  set(key: string, obj: any): void;
  clear(key: string): void;
}

export class SessionAuthContextStore extends AuthContextStore {

  private config: SessionConfig;
  private session: SessionStore;

  constructor(session: SessionStore, config: Partial<SessionConfig>) {
    super();
    this.config = {
      cookieName: 'session_id',
      timeout: 30 * 60 * 1000, // 30 minutes
      secure: false,
      ...config
    };
    this.session = session;
  }

  getId(request: Request) {
    return request.cookies[this.config.cookieName];
  }

  async refresh(request: Request, response: Response, context: AuthContext): Promise<void> {
    this.store(request, response, context);
  }

  async store(request: Request, response: Response, context: AuthContext): Promise<void> {
    const id = this.getId(request) || crypto.randomBytes(16).toString('hex');
    const domain = (request.header('host') || '').split(':')[0];

    response.cookie(this.config.cookieName, id, {
      domain,
      maxAge: this.config.timeout,
      httpOnly: true,
      secure: this.config.secure
    });

    this.session.set(id, context);
  }

  async load(request: Request): Promise<AuthContext | undefined> {
    const id = this.getId(request);
    return this.session.get(id);
  }
}