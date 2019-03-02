import * as util from 'util';

import { AppError } from '@travetto/base';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AuthService, ERR_INVALID_AUTH } from '@travetto/auth';

import { AuthProvider } from './provider';
import { AuthServiceAdapter } from './service-adapter';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  private providers = new Map<string, AuthProvider<any>>();

  constructor(private service: AuthService) {
    super();
  }

  async postConstruct() {
    for (const provider of DependencyRegistry.getCandidateTypes(AuthProvider as Class)) {
      const dep = await DependencyRegistry.getInstance(AuthProvider, provider.qualifier);
      this.providers.set(provider.qualifier.toString(), dep);
    }
  }

  getPrincipalState(req: Request) {
    return req.session!;
  }

  updatePrincipalState(req: Request, principal: any) {
    const state = this.getPrincipalState(req);

    if (state._authType) {
      const provider = this.providers.get(state._authType)!;
      const context = provider.toContext(principal);
      state._authStored = provider.serialize(this.service.context = context);
    } else {
      throw new Error('Principal not loaded, unable to serialize');
    }
  }

  async login(req: Request, res: Response, providers: symbol[]) {
    const errors = [];
    const state = this.getPrincipalState(req);
    for (const provider of providers) {
      const p = this.providers.get(provider.toString())!;
      try {
        const ctx = await p.login(req, res);
        if (ctx) {
          state._authStored = p.serialize(ctx);
          state._authType = provider.toString();

          this.service.context = ctx;
        }
        return ctx;
      } catch (e) {
        errors.push(e);
      }
    }

    const err = new AppError(ERR_INVALID_AUTH, 'authentication');
    err.stack = errors[errors.length - 1].stack;
    throw err;
  }

  async logout(req: Request, res: Response) {
    const state = this.getPrincipalState(req);
    const { _authType: type } = state;
    if (type) {
      await this.providers.get(type)!.logout(req, res);
    }

    this.service.clearContext();
    await util.promisify(state.destroy).call(state);
    res.cookie('connect.sid', undefined, { path: '/', expires: new Date(1) });
  }

  async loadContext(req: Request, res: Response) {
    const state = this.getPrincipalState(req);
    const { _authStored: serialized, _authType: type, _authPrincipal: principal } = (state || {}) as any;
    if (principal) {
      this.service.context = principal;
    } else if (serialized && type) {
      const provider = this.providers.get(type)!;
      const ctx = await provider.deserialize(serialized);
      this.service.context = ctx;
    }
  }

  intercept(req: Request, res: Response) {
    req.auth = new AuthServiceAdapter(this.service, this, req, res);
    return this.loadContext(req, res);
  }
}