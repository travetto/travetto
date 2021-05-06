// @file-if @travetto/model
import { AppError, Util, Class } from '@travetto/base';
import { ModelCrudSupport, ModelType, NotFoundError } from '@travetto/model';
import { EnvUtil } from '@travetto/boot';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';

import { Principal } from '../types/principal';
import { Authenticator } from '../types/authenticator';
import { Authorizer } from '../types/authorizer';
import { AuthUtil } from '../util';

/**
 * A set of registration data
 */
export interface RegisteredPrincipal extends Principal {
  /**
   * Password hash
   */
  hash?: string;
  /**
   * Password salt
   */
  salt?: string;
  /**
   * Temporary Reset Token
   */
  resetToken?: string;
  /**
   * End date for the reset token
   */
  resetExpires?: Date;
  /**
   * The actual password, only used on password set/update
   */
  password?: string;
}

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
    const ident = await this.#resolvePrincipal({ id: userId });

    const hash = await AuthUtil.generateHash(password, ident.salt!);
    if (hash !== ident.hash) {
      throw new AppError('Invalid password', 'authentication');
    } else {
      delete ident.password;
      return ident;
    }
  }

  async postConstruct() {
    if (isStorageSupported(this.#modelService) && EnvUtil.isDynamic()) {
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

    const fields = await AuthUtil.generatePassword(ident.password!);

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
      const pw = await AuthUtil.generateHash(oldPassword, ident.salt!);
      if (pw !== ident.hash) {
        throw new AppError('Old password is required to change', 'authentication');
      }
    }

    const fields = await AuthUtil.generatePassword(password);
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

    ident.resetToken = await AuthUtil.generateHash(Util.uuid(), salt, 25000, 32);
    ident.resetExpires = Util.timeFromNow('1h');

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