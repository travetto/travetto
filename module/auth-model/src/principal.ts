import { AppError } from '@travetto/base';
import { ModelService, Query, ModelCore } from '@travetto/model';
import { AuthUtil, Identity, Principal, PrincipalProvider } from '@travetto/auth';
import { Class } from '@travetto/registry';

export interface RegisteredIdentity extends Identity {
  hash: string;
  salt: string;
  resetToken: string;
  resetExpires: Date;
  password?: string;
}

export class ModelPrincipalProvider<T extends ModelCore> extends PrincipalProvider {

  constructor(
    private modelService: ModelService,
    private cls: Class<T>,
    public toIdentity: (t: T) => RegisteredIdentity,
    public fromIdentity: (t: Partial<RegisteredIdentity>) => Partial<T>,
  ) {
    super();
  }

  async retrieve(userId: string) {
    const query = {
      where: this.fromIdentity({ id: userId })
    } as Query<T>;
    const user = await this.modelService.getByQuery(this.cls, query);
    return user;
  }

  async resolvePrincipal(ident: Identity): Promise<Principal> {
    const user = await this.retrieve(ident.id);
    return this.toIdentity(user);
  }

  async authenticate(userId: string, password: string) {
    const user = await this.retrieve(userId);
    const ident = this.toIdentity(user);

    const hash = await AuthUtil.generateHash(password, ident.salt);
    if (hash !== ident.hash) {
      throw new AppError('Invalid password', 'authentication');
    } else {
      delete ident.password;
      return ident;
    }
  }

  async register(user: T) {
    const ident = this.toIdentity(user);

    const query = {
      where: this.fromIdentity({ id: ident.id })
    } as Query<T>;

    const existingUsers = await this.modelService.getAllByQuery(this.cls, query);

    if (existingUsers.length) {
      throw new AppError(`That id is already taken.`, 'data');
    } else {
      const fields = await AuthUtil.generatePassword(ident.password!);

      ident.password = undefined; // Clear it out on set

      Object.assign(user, this.fromIdentity(fields));

      const res: T = await this.modelService.save(this.cls, user);
      return res;
    }
  }

  async changePassword(userId: string, password: string, oldPassword?: string) {
    const user = await this.retrieve(userId);
    const ident = this.toIdentity(user);

    if (oldPassword !== undefined) {
      if (oldPassword === ident.resetToken) {
        if (ident.resetExpires.getTime() < Date.now()) {
          throw new AppError('Reset token has expired', 'data');
        }
      } else {
        const pw = await AuthUtil.generateHash(oldPassword, ident.salt);
        if (pw !== ident.hash) {
          throw new AppError('Old password is required to change', 'authentication');
        }
      }
    }

    const fields = await AuthUtil.generatePassword(password);
    Object.assign(user, this.fromIdentity(fields));

    return await this.modelService.update(this.cls, user);
  }

  async generateResetToken(userId: string): Promise<RegisteredIdentity> {
    const user = await this.retrieve(userId);
    const ident = this.toIdentity(user);
    const salt = await AuthUtil.generateSalt();

    ident.resetToken = await AuthUtil.generateHash(`${new Date().getTime()}`, salt, 25000, 32);
    ident.resetExpires = new Date(Date.now() + (60 * 60 * 1000 /* 1 hour */));

    Object.assign(user, this.fromIdentity(ident));

    await this.modelService.update(this.cls, user);

    return ident;
  }
}