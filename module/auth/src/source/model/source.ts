import { AppError } from '@travetto/express';
import { ModelService, BaseModel, Query } from '@travetto/model';

import { AuthUtil } from '../util';
import { AuthSource } from '../source';
import { RegisteredPrincipalProvider } from '../../principal';

export class AuthModelSource<T extends BaseModel> extends AuthSource<T, RegisteredPrincipalProvider<T>> {

  constructor(private modelService: ModelService) {
    super();
  }

  async fetchPrincipal(userId: string) {
    const query = {
      where: {
        [this.principalProvider.idField]: userId
      }
    } as Query<T>;
    const user = await this.modelService.getByQuery(this.principalProvider.type, query);
    return user;
  }

  async login(userId: string, password: string) {
    const user = await this.fetchPrincipal(userId);
    const hash = await AuthUtil.generateHash(password, this.principalProvider.getSalt(user));
    if (hash !== this.principalProvider.getHash(user)) {
      throw new AppError('Invalid password');
    } else {
      return user;
    }
  }

  async register(user: T, password: string) {
    const query = {
      where: {
        [this.principalProvider.idField]: this.principalProvider.getId(user)
      }
    } as Query<T>;

    const existingUsers = await this.modelService.getAllByQuery(this.principalProvider.type, query);

    if (existingUsers.length) {
      throw new AppError('That email is already taken.');
    } else {
      const fields = await AuthUtil.generatePassword(password);
      Object.assign(user as any, {
        [this.principalProvider.hashField]: fields.hash,
        [this.principalProvider.saltField]: fields.salt
      });

      delete (user as any)[this.principalProvider.passwordField];

      const res: T = await this.modelService.save(this.principalProvider.type, user);
      return res;
    }
  }

  async changePassword(userId: string, password: string, oldPassword?: string) {
    const user = await this.fetchPrincipal(userId);
    if (oldPassword !== undefined) {
      if (oldPassword === this.principalProvider.getResetToken(user)) {
        if (this.principalProvider.getResetExpires(user).getTime() < Date.now()) {
          throw new AppError('Reset token has expired');
        }
      } else {
        const pw = await AuthUtil.generateHash(oldPassword, this.principalProvider.getSalt(user));
        if (pw !== this.principalProvider.getHash(user)) {
          throw new AppError('Old password is required to change');
        }
      }
    }

    const fields = await AuthUtil.generatePassword(password);

    Object.assign(user as any, {
      [this.principalProvider.hashField]: fields.hash,
      [this.principalProvider.saltField]: fields.salt
    });

    return await this.modelService.update(this.principalProvider.type, user);
  }

  async generateResetToken(userId: string) {
    const user = await this.fetchPrincipal(userId);
    const salt = await AuthUtil.generateSalt();
    const password = await AuthUtil.generateHash(`${new Date().getTime()}`, salt, 25000, 32);

    Object.assign(user as any, {
      [this.principalProvider.resetTokenField]: password,
      [this.principalProvider.resetExpiresField]: new Date(Date.now() + (60 * 60 * 1000 /* 1 hour */))
    });

    await this.modelService.update(this.principalProvider.type, user);
    return user;
  }
}