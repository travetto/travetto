import * as passport from 'passport';
import * as moment from 'moment';
import { Request } from 'express';

import { AppError } from '@travetto/express';
import { ModelService, BaseModel, ModelRegistry } from '@travetto/model';
import { Class } from '@travetto/registry';

import { StrategyUtil } from '../../util';
import { AuthModelConfig } from './config';
import { AuthSource } from '../source';

export class AuthModelSource<T extends BaseModel> extends AuthSource<T, AuthModelConfig> {

  private modelClass: Class<T>;

  constructor(public config: AuthModelConfig, private modelService: ModelService) {
    super()
  }

  postConstruct() {
    if (!ModelRegistry.has(this.config.modelClass)) {
      throw new Error(`Auth model class ${this.config.modelClass} does not exist`);
    }
    this.modelClass = ModelRegistry.get(this.config.modelClass).class;
  }

  async getUser(username: string) {
    const query: any = {
      [this.config.usernameField]: username
    };
    const user = await this.modelService.getByQuery(this.modelClass, query);
    return user;
  }

  async doLogin(username: string, password: string) {
    const query: any = {
      [this.config.usernameField]: username
    };

    const user = await this.getUser(username);
    const hash = await StrategyUtil.generateHash(password, (user as any)[this.config.saltField]);
    if (hash !== (user as any)[this.config.hashField]) {
      throw new AppError('Invalid password');
    } else {
      return user;
    }
  }

  async register(user: T, password: string) {
    const query: any = {
      [this.config.usernameField]: (user as any)[this.config.usernameField]
    };

    const existingUsers = await this.modelService.getAllByQuery(this.modelClass, query);
    if (existingUsers.length) {
      throw new AppError('That email is already taken.');
    } else {
      const fields = await StrategyUtil.generatePassword(password);
      Object.assign(user as any, {
        [this.config.hashField]: fields.hash,
        [this.config.saltField]: fields.salt
      });

      delete (user as any)[this.config.passwordField];

      const res: T = await this.modelService.save(this.modelClass, user);
      return res;
    }
  }

  async changePassword(username: string, password: string, oldPassword?: string) {
    const user = await this.getUser(username);
    if (oldPassword !== undefined) {
      if (oldPassword === (user as any)[this.config.resetTokenField]) {
        if (moment((user as any)[this.config.resetExpiresField]).isBefore(new Date())) {
          throw new AppError('Reset token has expired');
        }
      } else {
        const pw = await StrategyUtil.generateHash(oldPassword, (user as any)[this.config.saltField]);
        if (pw !== (user as any)[this.config.hashField]) {
          throw new AppError('Old password is required to change');
        }
      }
    }

    const fields = await StrategyUtil.generatePassword(password);

    Object.assign(user as any, {
      [this.config.hashField]: fields.hash,
      [this.config.saltField]: fields.salt
    });

    return await this.modelService.update(this.modelClass, user);
  }

  async generateResetToken(username: string) {
    const user = await this.getUser(username);
    const salt = await StrategyUtil.generateSalt();
    const password = await StrategyUtil.generateHash(`${new Date().getTime()}`, salt, 25000, 32);

    Object.assign(user as any, {
      [this.config.resetTokenField]: password,
      [this.config.resetExpiresField]: moment().add(1, 'hour').toDate()
    });

    await this.modelService.update(this.modelClass, user);
    return user;
  }
}