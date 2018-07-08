import { AuthService } from '@travetto/auth';
import { AuthOperator } from './operator';
import { Request, Response } from 'express';

export class AuthServiceAdapter {
  constructor(
    private service: AuthService,
    private operator: AuthOperator,
    private req: Request,
    private res: Response
  ) { }

  get context() {
    return this.service.context;
  }

  get authenticated() {
    return this.service.authenticated;
  }

  get unauthenticated() {
    return this.service.unauthenticated;
  }

  checkPermissions(include: string[], exclude: string[]) {
    return this.service.checkPermissions(include, exclude);
  }

  async login(providers: symbol[]) {
    return await this.operator.login(this.req, this.res, providers);
  }

  async logout() {
    return await this.operator.logout(this.req, this.res);
  }
}