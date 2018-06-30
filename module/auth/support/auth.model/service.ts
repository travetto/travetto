import { ModelService, BaseModel, Query } from '@travetto/model';

import { AuthUtil } from '../../src/util';
import { RegisteredPrincipalConfig } from './principal';
import { ERR_INVALID_PASSWORD } from '../../src';

export class AuthModelService<T extends BaseModel> {

  constructor(
    private modelService: ModelService,
    private principal: RegisteredPrincipalConfig<T>
  ) { }

  async retrieve(userId: string) {
    const query = {
      where: {
        [this.principal.fields.id]: userId
      }
    } as Query<T>;
    const user = await this.modelService.getByQuery(this.principal.type, query);
    return user;
  }

  async login(userId: string, password: string) {
    const user = await this.retrieve(userId);
    const hash = await AuthUtil.generateHash(password, this.principal.getSalt(user));
    if (hash !== this.principal.getHash(user)) {
      throw new Error(ERR_INVALID_PASSWORD);
    } else {
      return user;
    }
  }

  async register(user: T) {
    const query = {
      where: {
        [this.principal.fields.id]: this.principal.getId(user)
      }
    } as Query<T>;

    const existingUsers = await this.modelService.getAllByQuery(this.principal.type, query);

    if (existingUsers.length) {
      throw new Error(`That ${this.principal.fields.id} is already taken.`);
    } else {
      const password = this.principal.getPassword(user);
      const fields = await AuthUtil.generatePassword(password);

      Object.assign(user as any, {
        [this.principal.fields.hash]: fields.hash,
        [this.principal.fields.salt]: fields.salt
      });

      delete (user as any)[this.principal.fields.password];

      const res: T = await this.modelService.save(this.principal.type, user);
      return res;
    }
  }

  async changePassword(userId: string, password: string, oldPassword?: string) {
    const user = await this.retrieve(userId);
    if (oldPassword !== undefined) {
      if (oldPassword === this.principal.getResetToken(user)) {
        if (this.principal.getResetExpires(user).getTime() < Date.now()) {
          throw new Error('Reset token has expired');
        }
      } else {
        const pw = await AuthUtil.generateHash(oldPassword, this.principal.getSalt(user));
        if (pw !== this.principal.getHash(user)) {
          throw new Error('Old password is required to change');
        }
      }
    }

    const fields = await AuthUtil.generatePassword(password);

    Object.assign(user as any, {
      [this.principal.fields.hash]: fields.hash,
      [this.principal.fields.salt]: fields.salt
    });

    return await this.modelService.update(this.principal.type, user);
  }

  async generateResetToken(userId: string) {
    const user = await this.retrieve(userId);
    const salt = await AuthUtil.generateSalt();
    const password = await AuthUtil.generateHash(`${new Date().getTime()}`, salt, 25000, 32);

    Object.assign(user as any, {
      [this.principal.fields.resetToken]: password,
      [this.principal.fields.resetExpires]: new Date(Date.now() + (60 * 60 * 1000 /* 1 hour */))
    });

    await this.modelService.update(this.principal.type, user);
    return user;
  }
}