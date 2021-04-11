import { AppError, Util, Class } from '@travetto/base';
import { ModelCrudSupport, ModelType, NotFoundError } from '@travetto/model';
import { Authenticator, Authorizer } from '@travetto/auth';
import { EnvUtil } from '@travetto/boot';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';
import { TimeUtil } from '@travetto/base/src/internal/time';

import { RegisteredPrincipal } from './principal';
import { RegistrationUtil } from './register-util';

/**
 * A model-based auth service
 */
export class ModelAuthService<T extends ModelType> implements
  Authenticator<T, RegisteredPrincipal>,
  Authorizer<RegisteredPrincipal>
{

  #modelService: ModelCrudSupport;
  #cls: Class<T>;

  /**
   * Build a Model Principal Source
   *
   * @param cls Model class for the principal
   * @param toPrincipal Convert a model to an principal
   * @param fromPrincipal Convert an identity to the model
   */
  constructor(
    modelService: ModelCrudSupport,
    cls: Class<T>,
    public toPrincipal: (t: T) => RegisteredPrincipal,
    public fromPrincipal: (t: Partial<RegisteredPrincipal>) => Partial<T>,
  ) {
    this.#modelService = modelService;
    this.#cls = cls;
  }

  /**
   * Retrieve user by id
   * @param userId The user id to retrieve
   */
  async #retrieve(userId: string) {
    return await this.#modelService.get<T>(this.#cls, userId);
  }

  /**
   * Convert identity to a principal
   * @param ident The registered identity to resolve
   */
  async #resolvePrincipal(ident: RegisteredPrincipal) {
    const user = await this.#retrieve(ident.id);
    return this.toPrincipal(user);
  }

  /**
   * Authenticate password for model id
   * @param userId The user id to authenticate against
   * @param password The password to authenticate against
   */
  async #authenticate(userId: string, password: string) {
    const user = await this.#retrieve(userId);
    const ident = await this.toPrincipal(user);

    const hash = await RegistrationUtil.generateHash(password, ident.salt!);
    if (hash !== ident.hash) {
      throw new AppError('Invalid password', 'authentication');
    } else {
      delete ident.password;
      return ident;
    }
  }

  async postConstruct() {
    if (isStorageSupported(this.#modelService) && !EnvUtil.isReadonly()) {
      await this.#modelService.createModel?.(this.#cls);
    }
  }

  /**
   * Register a user
   * @param user The user to register
   */
  async register(user: T) {
    const ident = this.toPrincipal(user);

    try {
      if (ident.id) {
        await this.#retrieve(ident.id);
        throw new AppError('That id is already taken.', 'data');
      }
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        throw e;
      }
    }

    const fields = await RegistrationUtil.generatePassword(ident.password!);

    ident.password = undefined; // Clear it out on set

    Object.assign(user, this.fromPrincipal(fields));

    const res: T = await this.#modelService.create(this.#cls, user);
    return res;
  }

  /**
   * Change a password
   * @param userId The user id to affet
   * @param password The new password
   * @param oldPassword The old password
   */
  async changePassword(userId: string, password: string, oldPassword?: string) {
    const user = await this.#retrieve(userId);
    const ident = this.toPrincipal(user);

    if (oldPassword === ident.resetToken) {
      if (ident.resetExpires && ident.resetExpires.getTime() < Date.now()) {
        throw new AppError('Reset token has expired', 'data');
      }
    } else if (oldPassword !== undefined) {
      const pw = await RegistrationUtil.generateHash(oldPassword, ident.salt!);
      if (pw !== ident.hash) {
        throw new AppError('Old password is required to change', 'authentication');
      }
    }

    const fields = await RegistrationUtil.generatePassword(password);
    Object.assign(user, this.fromPrincipal(fields));

    return await this.#modelService.update(this.#cls, user);
  }

  /**
   * Generate a reset token
   * @param userId The user to reset for
   */
  async generateResetToken(userId: string): Promise<RegisteredPrincipal> {
    const user = await this.#retrieve(userId);
    const ident = this.toPrincipal(user);
    const salt = await Util.uuid();

    ident.resetToken = await RegistrationUtil.generateHash(Util.uuid(), salt, 25000, 32);
    ident.resetExpires = TimeUtil.withAge(1, 'h');

    Object.assign(user, this.fromPrincipal(ident));

    await this.#modelService.update(this.#cls, user);

    return ident;
  }

  /**
   * Authorize principal into known user
   * @param principal 
   * @returns Authorized principal
   */
  authorize(principal: RegisteredPrincipal) {
    return this.#resolvePrincipal(principal);
  }

  /**
   * Authenticate entity into a principal
   * @param payload 
   * @returns Authenticated principal
   */
  authenticate(payload: T) {
    const { id, password } = this.toPrincipal(payload);
    return this.#authenticate(id, password!);
  }
}