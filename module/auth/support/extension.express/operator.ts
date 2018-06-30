import * as util from 'util';
import { Request, Response } from 'express';

import { ExpressOperator, ExpressApp, AppError } from '@travetto/express';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';

import { AuthService } from '../../src/service/auth';
import { AuthProvider } from './provider';
import { ERR_INVALID_AUTH } from '../../src';

export const AUTH = Symbol('@travetto/auth');

@Injectable({
  target: ExpressOperator,
  qualifier: AUTH
})
export class AuthOperator extends ExpressOperator {

  private providers = new Map<string, AuthProvider<any>>();

  constructor(private service: AuthService) {
    super();
  }

  async postConstruct() {
    for (const provider of DependencyRegistry.getCandidateTypes(AuthProvider)) {
      const dep = await DependencyRegistry.getInstance(provider.class);
      this.providers.set(provider.class.__id, dep);
    }
  }

  async login(req: Request, res: Response, providers: Class[]) {
    const errors = [];
    for (const provider of providers) {
      const p = this.providers.get(provider.__id)!;
      try {
        const user = await p.login(req, res);
        this.service.context = user;
        req.session!._authId = p.serialize(user);
        req.session!._authType = provider.__id;
        return user;
      } catch (e) {
        errors.push(e);
      }
    }

    const err = new AppError(ERR_INVALID_AUTH, 401);
    err.stack = errors[errors.length - 1].stack;
    throw err;
  }

  async logout(req: Request, res: Response) {
    const { _authType: type } = req.session!;
    if (type) {
      await this.providers.get(type)!.logout(req, res);
    }

    this.service.clearContext();
    await util.promisify(req.session!.destroy).call(req.session);
    res.clearCookie('connect.sid', { path: '/' });
  }

  async loadContext(req: Request, res: Response) {
    const { _authId: id, _authType: type, _authPrincipal: principal } = req.session!;
    if (principal) {
      this.service.context = principal;
    } else if (id && type) {
      const user = await this.providers.get(type)!.deserialize(id);
      this.service.context = user;
    }
  }

  operate(app: ExpressApp) {
    app.get().use(async (req, res, next) => {

      const r = req as Request;

      r.auth = this.service;
      r.doLogin = this.login.bind(this, req, res);
      await this.loadContext(r, res);

      if (next) {
        next();
      }
    });
  }
}