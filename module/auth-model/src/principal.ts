import { AppError, Util } from '@travetto/base';
import { Inject } from '@travetto/di';
import { ModelCrudSupport, ModelType, NotFoundError } from '@travetto/model-core';
import { AuthContext, AuthUtil, Principal, PrincipalSource } from '@travetto/auth';
import { Class } from '@travetto/registry';

import { RegisteredIdentity } from './identity';

export const AuthModelSymbol = Symbol.for('@trv:auth-model/model');

/**
 * A model-based principal source
 */
export class ModelPrincipalSource<T extends ModelType> implements PrincipalSource {

  @Inject(AuthModelSymbol)
  private modelService: ModelCrudSupport;

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
  ) { }

  /**
   * Retrieve user by id
   * @param userId The user id to retrieve
   */
  async retrieve(userId: string) {
    return await this.modelService.get<T>(this.cls, userId);
  }

  /**
   * Convert identity to a principal
   * @param ident The registered identity to resolve
   */
  async resolvePrincipal(ident: RegisteredIdentity): Promise<Principal> {
    const user = await this.retrieve(ident.id);
    return this.toIdentity(user);
  }

  /**
   * Authenticate password for model id
   * @param userId The user id to authenticate against
   * @param password The password to authenticate against
   */
  async authenticate(userId: string, password: string) {
    const user = await this.retrieve(userId);
    const ident = await this.toIdentity(user);

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
   * @param user The user to register
   */
  async register(user: T) {
    const ident = this.toIdentity(user);

    try {
      await this.retrieve(ident.id);
      throw new AppError('That id is already taken.', 'data');
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        throw e;
      }

      const fields = await AuthUtil.generatePassword(ident.password!);

      ident.password = undefined; // Clear it out on set

      Object.assign(user, this.fromIdentity(fields));

      const res: T = await this.modelService.create(this.cls, user);
      return res;
    }
  }

  /**
   * Change a password
   * @param userId The user id to affet
   * @param password The new password
   * @param oldPassword The old password
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
   * @param userId The user to reset for
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

  async authorize(ident: RegisteredIdentity) {
    return new AuthContext(ident, await this.resolvePrincipal(ident));
  }
}