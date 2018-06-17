import { AppError } from '@travetto/express';
import { ModelService, BaseModel, Query } from '@travetto/model';

import { AuthSource, AuthUtil } from '../src/source';
import { RegisteredPrincipalConfig } from '../src/principal';

export class AuthModelSource<T extends BaseModel> extends AuthSource<T, RegisteredPrincipalConfig<T>> {

  constructor(private modelService: ModelService, principalConfig: RegisteredPrincipalConfig<T>) {
    super(principalConfig);
  }

  async retrieve(userId: string) {
    const query = {
      where: {
        [this.principal.idField]: userId
      }
    } as Query<T>;
    const user = await this.modelService.getByQuery(this.principal.type, query);
    return user;
  }

  async login(userId: string, password: string) {
    const user = await this.retrieve(userId);
    const hash = await AuthUtil.generateHash(password, this.principal.getSalt(user));
    if (hash !== this.principal.getHash(user)) {
      throw new AppError('Invalid password');
    } else {
      return user;
    }
  }

  async register(user: T) {
    const query = {
      where: {
        [this.principal.idField]: this.principal.getId(user)
      }
    } as Query<T>;

    const existingUsers = await this.modelService.getAllByQuery(this.principal.type, query);

    if (existingUsers.length) {
      throw new AppError(`That ${this.principal.idField} is already taken.`);
    } else {
      const password = this.principal.getPassword(user);
      const fields = await AuthUtil.generatePassword(password);

      Object.assign(user as any, {
        [this.principal.hashField]: fields.hash,
        [this.principal.saltField]: fields.salt
      });

      delete (user as any)[this.principal.passwordField];

      const res: T = await this.modelService.save(this.principal.type, user);
      return res;
    }
  }

  async changePassword(userId: string, password: string, oldPassword?: string) {
    const user = await this.retrieve(userId);
    if (oldPassword !== undefined) {
      if (oldPassword === this.principal.getResetToken(user)) {
        if (this.principal.getResetExpires(user).getTime() < Date.now()) {
          throw new AppError('Reset token has expired');
        }
      } else {
        const pw = await AuthUtil.generateHash(oldPassword, this.principal.getSalt(user));
        if (pw !== this.principal.getHash(user)) {
          throw new AppError('Old password is required to change');
        }
      }
    }

    const fields = await AuthUtil.generatePassword(password);

    Object.assign(user as any, {
      [this.principal.hashField]: fields.hash,
      [this.principal.saltField]: fields.salt
    });

    return await this.modelService.update(this.principal.type, user);
  }

  async generateResetToken(userId: string) {
    const user = await this.retrieve(userId);
    const salt = await AuthUtil.generateSalt();
    const password = await AuthUtil.generateHash(`${new Date().getTime()}`, salt, 25000, 32);

    Object.assign(user as any, {
      [this.principal.resetTokenField]: password,
      [this.principal.resetExpiresField]: new Date(Date.now() + (60 * 60 * 1000 /* 1 hour */))
    });

    await this.modelService.update(this.principal.type, user);
    return user;
  }
}