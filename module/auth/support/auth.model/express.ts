import { Request, Response } from 'express';

import { AppError } from '@travetto/express';
import { BaseModel } from '@travetto/model';

import { AuthProvider } from '../extension.express/provider';
import { RegisteredPrincipalConfig } from './principal';
import { AuthModelService } from './service';
import { ERR_INVALID_PASSWORD } from '../../src';

export class AuthModelProvider<U extends BaseModel> extends AuthProvider<U, RegisteredPrincipalConfig<U>> {

  constructor(
    private service: AuthModelService<U>,
    principal: RegisteredPrincipalConfig<U>
  ) {
    super(principal);
  }

  private extractLogin(...objs: { [key: string]: string }[]) {
    const idField = this.principal.fields.id;
    const pwField = this.principal.fields.password;

    const valid = (objs.find(x => idField in x) || {}) as any as U;

    return {
      userId: valid[idField] as any as string,
      password: valid[pwField] as any as string
    };
  }

  async login(req: Request, res: Response) {
    const { userId, password } = this.extractLogin(req.body, req.query);
    try {
      const user = await this.service.login(userId, password);
      return user;
    } catch (e) {
      let status = 500;
      switch ((e as Error).message) {
        case ERR_INVALID_PASSWORD:
          status = 401;
          break;
      }
      const out = new AppError(e.message, status);
      out.stack = e.stack;
      throw out;
    }
  }

  async deserialize(id: string) {
    return this.service.retrieve(id);
  }
}