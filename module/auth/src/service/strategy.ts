import * as passport from 'passport';
import * as moment from 'moment';
import { Request } from 'express';

import {
  Strategy,
  IStrategyOptions as Options,
  IStrategyOptionsWithRequest as OptionsWithRequest
} from 'passport-local';

import { AppError } from '@travetto/express';
import { Injectable, Inject } from '@travetto/di';
import { Context } from '@travetto/context';
import { AuthSource } from '../source';

export type Callback<T> = (err?: any, res?: T) => void

@Injectable()
export class AuthStrategy<U = any> extends Strategy {

  @Inject()
  protected context: Context;

  constructor(protected source: AuthSource<U>) {
    super({
      ...(source.config as any),
      ...{
        passReqToCallback: true // allows us to pass back the entire request to the callback
      }
    } as OptionsWithRequest,
      (req: Request, email: string, pw: string, done: Callback<U>) =>
        this.filterAuth(req, email, pw, done));

    if (source.register) {
      this.register = async (user: U, password: string) => {
        const res = await this.source.register!(user, password);

        try {
          this.context.get().user = res;
        } catch (e) {
          // Do nothing
        }

        return res;
      };
    }
    if (source.changePassword) {
      this.changePassword = source.changePassword.bind(source);
    }
  }

  async login(email: string, password: string): Promise<U> {
    try {
      const user = await this.doLogin(email, password);
      this.context.get().user = user;
      return user;
    } catch (err) {
      console.error(err);
      throw new AppError('Unable to authenticate, username/password combination are invalid');
    }
  }

  getUser(id: string): Promise<U> {
    return this.source.getUser(id);
  }

  doLogin(email: string, password: string): Promise<U> {
    return this.source.doLogin(email, password);
  }

  serialize(user: U, done: Callback<string>) {
    done(null, (user as any)[this.source.config.usernameField!]);
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