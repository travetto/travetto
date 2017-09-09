import * as passport from 'passport';
import * as moment from 'moment';
import { Request } from 'express';

import { StrategyUtil } from '../../src/util';
import { MongoStrategyConfig } from './types';
import { AppError } from '@encore2/express';
import { ModelService, BaseModel } from '@encore2/model';
import { BaseStrategy } from '../../src/service/strategy';
import { Injectable } from '@encore2/di';

@Injectable()
export class MongoStrategy<T extends BaseModel> extends BaseStrategy<T, MongoStrategyConfig> {

  constructor(config: MongoStrategyConfig) {
    super(config)
  }

  async getUser(username: string) {
    let query: any = {
      [this.config.usernameField]: username
    };
    let user = await ModelService.findOne(cls, query);
    return user;
  }

  async doLogin(username: string, password: string) {
    let query: any = {
      [this.config.usernameField]: username
    };

    let user = await this.getUser(username);
    let hash = await StrategyUtil.generateHash(password, (user as any)[this.config.saltField]);
    if (hash !== (user as any)[this.config.hashField]) {
      throw new AppError('Invalid password');
    } else {
      return user;
    }
  }

  async register(user: T, password: string) {
    let query: any = {
      [this.config.usernameField]: (user as any)[this.config.usernameField]
    };

    let existingUsers = await ModelService.getByQuery(cls, query);
    if (existingUsers.length) {
      throw new AppError('That email is already taken.');
    } else {
      let fields = await StrategyUtil.generatePassword(password);
      Object.assign(user as any, {
        [this.config.hashField]: fields.hash,
        [this.config.saltField]: fields.salt
      });

      delete (user as any)[this.config.passwordField];

      let res = await ModelService.save(user);
      try {
        this.context.get().user = user;
      } catch (e) {
        // Do nothing
      }
      return res;
    }
  }

  async changePassword(username: string, password: string, oldPassword?: string) {
    let user = await this.getUser(username);
    if (oldPassword !== undefined) {
      if (oldPassword === (user as any)[this.config.resetTokenField]) {
        if (moment((user as any)[this.config.resetExpiresField]).isBefore(new Date())) {
          throw new AppError('Reset token has expired');
        }
      } else {
        let pw = await StrategyUtil.generateHash(oldPassword, (user as any)[this.config.saltField]);
        if (pw !== (user as any)[this.config.hashField]) {
          throw new AppError('Old password is required to change');
        }
      }
    }

    let fields = await StrategyUtil.generatePassword(password);

    Object.assign(user as any, {
      [this.config.hashField]: fields.hash,
      [this.config.saltField]: fields.salt
    });

    return await ModelService.update(user);
  }

  async generateResetToken(username: string) {
    let user = await this.getUser(username);
    let salt = await StrategyUtil.generateSalt();
    let password = await StrategyUtil.generateHash('' + (new Date().getTime()), salt, 25000, 32);

    Object.assign(user as any, {
      [this.config.resetTokenField]: password,
      [this.config.resetExpiresField]: moment().add(1, 'hour').toDate()
    });

    await ModelService.update(user);
    return user;
  }
}