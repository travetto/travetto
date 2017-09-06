import * as passport from 'passport';
import * as http from 'http';

import { requestJSON } from '@encore/util';
import { Injectable } from '@encore/di';
import { Context } from '@encore/context';

import { CrowdStrategyConfig } from './config';

import { AppError } from '@encore/express';
import { Strategy as LocalStrategy } from 'passport-local';
import { promiseToNode } from '@encore/base';

type Callback<T> = (err: any, value?: T) => any;

@Injectable()
export class CrowdStrategy<T> {
  constructor(private config: CrowdStrategyConfig, private context: Context) {
  }

  postConstruct() {

    // used to serialize the user for the session
    passport.serializeUser((user: T, done: Callback<string>) =>
      done(null, (user as any)[this.config.usernameField]));

    // used to deserialize the user
    passport.deserializeUser(async (username: string, done: Callback<T>) =>
      this.getUser(username).then(v => done(undefined, v)).catch(done)
    );

    passport.use('local', new LocalStrategy({
      usernameField: this.config.usernameField,
      passwordField: this.config.passwordField,
      passReqToCallback: true // allows us to pass back the entire request to the callback
    }, async function (req, email, password, done) {
      try {
        let res = await login(email, password);
        if (req.passportOptions.successRedirect) {
          this.success(res);
        } else {
          done(null, res);
        }
      } catch (e) {
        if (req.passportOptions.failureRedirect) {
          this.fail(e);
        } else {
          done(e);
        }
      }
    }));
  }

  async request<Z, U>(path: string, options: http.RequestOptions = {}, data?: U) {
    return await requestJSON<Z, U>({
      auth: `${this.config.application}:${this.config.password}`,
      url: `${this.config.baseUrl}/rest/usermanagement/latest${path}`
    }, data);
  }

  async getUser(username: string) {
    return await this.request<T, any>(`/user?username=${username}`);
  }

  async login(username: string, password: string) {
    try {
      let crowdUser = await this.request(`/authentication?username=${username}`, {
        method: 'POST',
      }, { value: password });
      this.context.get().user = crowdUser;
      return crowdUser;
    } catch (err) {
      console.error(err);
      throw new AppError(err);
    }
  }
}