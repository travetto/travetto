import { ModelService, Query, ModelCore } from '@travetto/model';
import { AuthUtil, ERR_INVALID_PASSWORD } from '@travetto/auth';

import { RegisteredPrincipalConfig } from './principal';

export class AuthModelService<T extends ModelCore> {

  constructor(
    private modelService: ModelService,
    public principalConfig: RegisteredPrincipalConfig<T>
  ) { }

  async retrieve(userId: string) {
    const query = {
      where: {
        [this.principalConfig.fields.id]: userId
      }
    } as Query<T>;
    const user = await this.modelService.getByQuery(this.principalConfig.type, query);
    return user;
  }

  async login(userId: string, password: string) {
    const user = await this.retrieve(userId);
    const hash = await AuthUtil.generateHash(password, this.principalConfig.getSalt(user));
    if (hash !== this.principalConfig.getHash(user)) {
      throw new Error(ERR_INVALID_PASSWORD);
    } else {
      return user;
    }
  }

  async register(user: T) {
    const query = {
      where: {
        [this.principalConfig.fields.id]: this.principalConfig.getId(user)
      }
    } as Query<T>;

    const existingUsers = await this.modelService.getAllByQuery(this.principalConfig.type, query);

    if (existingUsers.length) {
      throw new Error(`That ${this.principalConfig.fields.id} is already taken.`);
    } else {
      const password = this.principalConfig.getPassword(user);
      const fields = await AuthUtil.generatePassword(password);

      Object.assign(user as any, {
        [this.principalConfig.fields.hash]: fields.hash,
        [this.principalConfig.fields.salt]: fields.salt
      });

      delete (user as any)[this.principalConfig.fields.password];

      const res: T = await this.modelService.save(this.principalConfig.type, user);
      return res;
    }
  }

  async changePassword(userId: string, password: string, oldPassword?: string) {
    const user = await this.retrieve(userId);
    if (oldPassword !== undefined) {
      if (oldPassword === this.principalConfig.getResetToken(user)) {
        if (this.principalConfig.getResetExpires(user).getTime() < Date.now()) {
          throw new Error('Reset token has expired');
        }
      } else {
        const pw = await AuthUtil.generateHash(oldPassword, this.principalConfig.getSalt(user));
        if (pw !== this.principalConfig.getHash(user)) {
          throw new Error('Old password is required to change');
        }
      }
    }

    const fields = await AuthUtil.generatePassword(password);

    Object.assign(user as any, {
      [this.principalConfig.fields.hash]: fields.hash,
      [this.principalConfig.fields.salt]: fields.salt
    });

    return await this.modelService.update(this.principalConfig.type, user);
  }

  async generateResetToken(userId: string) {
    const user = await this.retrieve(userId);
    const salt = await AuthUtil.generateSalt();
    const password = await AuthUtil.generateHash(`${new Date().getTime()}`, salt, 25000, 32);

    Object.assign(user as any, {
      [this.principalConfig.fields.resetToken]: password,
      [this.principalConfig.fields.resetExpires]: new Date(Date.now() + (60 * 60 * 1000 /* 1 hour */))
    });

    await this.modelService.update(this.principalConfig.type, user);
    return user;
  }
}