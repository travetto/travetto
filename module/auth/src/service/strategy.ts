import * as passport from 'passport';
import * as moment from 'moment';
import { Request } from 'express';

import { AppError } from '@travetto/express';
import {
  Strategy,
  IStrategyOptions as Options,
  IStrategyOptionsWithRequest as OptionsWithRequest
} from 'passport-local';
import { Injectable, Inject } from '@travetto/di';
import { Context } from '@travetto/context';

export type Callback<T> = (err?: any, res?: T) => void

@Injectable()
export abstract class BaseStrategy<U, T extends Options> extends Strategy {

  @Inject()
  protected context!: Context;

  constructor(protected config: T) {
    super(Object.assign({}, config, {
      passReqToCallback: true // allows us to pass back the entire request to the callback
    }) as OptionsWithRequest, (req: Request, email: string, pw: string, done: Callback<U>) => this.filterAuth(req, email, pw, done));
  }

  abstract getUser(id: string): Promise<U>;

  async login(email: string, password: string): Promise<U> {
    try {
      const user = await this.doLogin(email, password);
      this.context.get().user = user;
      return user;
    } catch (err) {
      console.error(err);
      throw new AppError(err);
    }
  }

  abstract doLogin(email: string, password: string): Promise<U>;

  serialize(user: T, done: Callback<string>) {
    done(null, (user as any)[this.config.usernameField!]);
  }

  async deserialize(username: string, done: Callback<U>) {
    try {
      const user = await this.getUser(username);
      done(undefined, user);
    } catch (err) {
      done(err);
    }
  }

  async filterAuth(req: Request, email: string, password: string, done: Callback<U>) {
    try {
      const res = await this.login(email, password);
      if (req.passportOptions.successRedirect) {
        this.success(res, undefined);
      } else {
        done(null, res);
      }
    } catch (err) {
      if (req.passportOptions.failureRedirect) {
        this.fail(err);
      } else {
        done(err, undefined);
      }
    }
  }

  register?(user: U, password: string): Promise<U>;
  changePassword?(username: string, password: string, oldPassword?: string): Promise<U>;
}