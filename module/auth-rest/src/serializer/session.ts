import * as crypto from 'crypto';

import { AuthContext } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { RestAuthContextSerializer } from './rest';

interface SessionConfig {
  cookieName: string;
  timeout: number;
  secure: boolean;
}

export interface SessionStore {
  get(key: string): any;
  set(key: string, obj: any): void;
  clear(key: string): void;
}

export class SessionAuthContextSerializer extends RestAuthContextSerializer {

  private config: SessionConfig;
  private store: SessionStore;

  constructor(store: SessionStore, config: Partial<SessionConfig>) {
    super();
    this.config = {
      cookieName: 'session_id',
      timeout: 30 * 60 * 1000, // 30 minutes
      secure: false,
      ...config
    };
    this.store = store;
  }

  async serialize(context: AuthContext): Promise<string> {
    const id = crypto.randomBytes(16).toString('hex');
    this.store.set(id, context);
    return id;
  }

  async deserialize(id: string): Promise<AuthContext> {
    return this.store.get(id)!;
  }

  async refresh(request: Request, response: Response, context: AuthContext): Promise<void> {
    const id = await this.getFromRequest(request);
    if (id) {
      this.writeToResponse(request, response, id, context);
    }
  }

  async writeToResponse(request: Request, response: Response, id: string, context: AuthContext): Promise<void> {
    const domain = (request.header('host') || '').split(':')[0];
    response.cookie(this.config.cookieName, id, { domain, maxAge: this.config.timeout, httpOnly: true, secure: this.config.secure });
  }

  async getFromRequest(request: Request): Promise<string | undefined> {
    return request.cookies[this.config.cookieName];
  }
}