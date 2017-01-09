import * as passport from 'passport';
import * as moment from 'moment';

import { MongoStrategyUtil } from './util';
import { MongoStrategyConfig } from './types';
import { AppError } from '@encore/express';
import { ModelService, ModelCls, BaseModel } from '@encore/model';
import { Strategy as LocalStrategy } from 'passport-local';
import { Context } from '@encore/context';

export function MongoStrategy<T extends BaseModel>(cls: ModelCls<T>, config: MongoStrategyConfig) {

  async function login(username: string, password: string) {
    let query: any = {
      [config.usernameField]: username
    };

    try {
      let user = await ModelService.findOne(cls, query);
      let hash = await MongoStrategyUtil.generateHash(password, (user as any)[config.saltField]);
      if (hash !== (user as any)[config.hashField]) {
        throw new AppError('Invalid password');
      } else {
        try {
          Context.get().user = user;
        } catch (e) {
          // Do nothing
        }
        return user;
      }
    } catch (e) {
      throw new AppError('User is not found');
    }
  }

  async function register(user: T, password: string) {
    let query: any = {
      [config.usernameField]: (user as any)[config.usernameField]
    };

    let existingUsers = await ModelService.getByQuery(cls, query);
    if (existingUsers.length) {
      throw new AppError('That email is already taken.');
    } else {
      let fields = await MongoStrategyUtil.generatePassword(password);
      Object.assign(user as any, {
        [config.hashField]: fields.hash,
        [config.saltField]: fields.salt
      });

      delete (user as any)[config.passwordField];

      let res = await ModelService.save(user);
      try {
        Context.get().user = user;
      } catch (e) {
        // Do nothing
      }
      return res;
    }
  }

  async function changePassword(username: string, password: string, oldPassword?: string) {
    let query: any = {
      [config.usernameField]: username
    };

    let user = await ModelService.findOne(cls, query);
    if (oldPassword !== undefined) {
      if (oldPassword === (user as any)[config.resetTokenField]) {
        if (moment((user as any)[config.resetExpiresField]).isBefore(new Date())) {
          throw new AppError('Reset token has expired');
        }
      } else {
        let pw = await MongoStrategyUtil.generateHash(oldPassword, (user as any)[config.saltField]);
        if (pw !== (user as any)[config.hashField]) {
          throw new AppError('Old password is required to change');
        }
      }
    }

    let fields = await MongoStrategyUtil.generatePassword(password);

    Object.assign(user as any, {
      [config.hashField]: fields.hash,
      [config.saltField]: fields.salt
    });

    return await ModelService.update(user);
  }

  async function generateResetToken(username: string) {
    let query: any = {
      [config.usernameField]: username
    };

    let user = await ModelService.findOne(cls, query);
    let salt = await MongoStrategyUtil.generateSalt();
    let password = await MongoStrategyUtil.generateHash('' + (new Date().getTime()), salt, 25000, 32);

    Object.assign(user as any, {
      [config.resetTokenField]: password,
      [config.resetExpiresField]: moment().add(1, 'hour').toDate()
    });

    await ModelService.update(user);
    return user;
  }

  // used to serialize the user for the session
  passport.serializeUser((user: T, done: Function) => done(null, user._id));

  // used to deserialize the user
  passport.deserializeUser(async (id: string, done: (err: any, user?: T) => void) => {
    ModelService.getById(cls, id).then(
      (u: T) => done(null, u),
      (err: any) => done(err));
  });

  passport.use('local', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField: config.usernameField,
    passwordField: config.passwordField,
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

  return {
    login,
    register,
    changePassword,
    generateResetToken
  };
}