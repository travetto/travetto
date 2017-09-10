import * as passport from 'passport';
import * as moment from 'moment';
import { Request } from 'express';

import { AppError } from '@encore2/express';
import {
  Strategy,
  IStrategyOptions as Options,
  IStrategyOptionsWithRequest as OptionsWithRequest
} from 'passport-local';
import { Injectable, Inject } from '@encore2/di';
import { Context } from '@encore2/context';

export type Callback<T> = (err?: any, res?: T) => void

@Injectable()
export abstract class BaseStrategy<U, T extends Options> extends Strategy {

  @Inject()
  protected context: Context;

  constructor(protected config: T) {
    super(Object.assign({}, config, {
      passReqToCallback: true // allows us to pass back the entire request to the callback
    }) as OptionsWithRequest, (req: Request, email: string, pw: string, done: Callback<U>) => this.filterAuth(req, email, pw, done));
  }

  abstract getUser(id: string): Promise<U>;

  async login(email: string, password: string): Promise<U> {
    try {
      let user = await this.doLogin(email, password);
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
      let u = await this.getUser(username);
      done(undefined, u);
    } catch (e) {
      done(e);
    }
  }

  async filterAuth(req: Request, email: string, password: string, done: Callback<U>) {
    try {
      let res = await this.login(email, password);
      if (req.passportOptions.successRedirect) {
        this.success(res, undefined);
      } else {
        done(null, res);
      }
    } catch (e) {
      if (req.passportOptions.failureRedirect) {
        this.fail(e);
      } else {
        done(e, undefined);
      }
    }
  }
}