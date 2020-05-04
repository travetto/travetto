import { AppError, Util } from '@travetto/base';
import { Inject } from '@travetto/di';
import { ModelService, Query, ModelCore } from '@travetto/model';
import { AuthUtil, Principal, PrincipalSource } from '@travetto/auth';
import { Class } from '@travetto/registry';

import { RegisteredIdentity } from './identity';

/**
 * A model-based principal source
 */
export class ModelPrincipalSource<T extends ModelCore> extends PrincipalSource {

  @Inject()
  private modelService: ModelService;

  /**
   * Build a Model Principal Source
   *
   * @param cls Model class for the principal
   * @param toIdentity Convert a model to an identity
   * @param fromIdentity Convert an identity to the model
   */
  constructor(
    private cls: Class<T>,
    public toIdentity: (t: T) => RegisteredIdentity,
    public fromIdentity: (t: Partial<RegisteredIdentity>) => Partial<T>,
  ) {
    super();
  }

  /**
   * Retrieve user by id
   */
  async retrieve(userId: string) {
    const query = {
      where: this.fromIdentity({ id: userId })
    } as Query<T>;
    const user = await this.modelService.getByQuery(this.cls, query);
    return user;
  }

  /**
   * Convert identity to a principal
   */
  async resolvePrincipal(ident: RegisteredIdentity): Promise<Principal> {
    const user = await this.retrieve(ident.id);
    return this.toIdentity(user);
  }

  /**
   * Authenticate password for model id
   */
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

  /**
   * Register a user
   */
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

  /**
   * Change a password
   */
  async changePassword(userId: string, password: string, oldPassword?: string) {
    const user = await this.retrieve(userId);
    const ident = this.toIdentity(user);

    if (oldPassword !== undefined) {
      if (oldPassword === ident.resetToken) {
        if (ident.resetExpires && ident.resetExpires.getTime() < Date.now()) {
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

  /**
   * Generate a reset token
   */
  async generateResetToken(userId: string): Promise<RegisteredIdentity> {
    const user = await this.retrieve(userId);
    const ident = this.toIdentity(user);
    const salt = await Util.uuid();

    ident.resetToken = await AuthUtil.generateHash(`${new Date().getTime()}`, salt, 25000, 32);
    ident.resetExpires = new Date(Date.now() + (60 * 60 * 1000 /* 1 hour */));

    Object.assign(user, this.fromIdentity(ident));

    await this.modelService.update(this.cls, user);

    return ident;
  }
}