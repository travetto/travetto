import { Util, Class, TimeUtil, Runtime } from '@travetto/runtime';
import { ModelCrudSupport, ModelType, NotFoundError, OptionalId } from '@travetto/model';
import { Principal, Authenticator, Authorizer, AuthenticationError } from '@travetto/auth';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';

import { AuthModelUtil } from './util';

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

type ToPrincipal<T extends ModelType> = (t: OptionalId<T>) => RegisteredPrincipal;
type FromPrincipal<T extends ModelType> = (t: Partial<RegisteredPrincipal>) => Partial<T>;;

/**
 * A model-based auth service
 */
export class ModelAuthService<T extends ModelType> implements Authenticator<T>, Authorizer {

  #modelService: ModelCrudSupport;
  #cls: Class<T>;

  toPrincipal: ToPrincipal<T>;
  fromPrincipal: FromPrincipal<T>;

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
    toPrincipal: ToPrincipal<T>,
    fromPrincipal: FromPrincipal<T>,
  ) {
    this.#modelService = modelService;
    this.#cls = cls;
    this.toPrincipal = toPrincipal;
    this.fromPrincipal = fromPrincipal;
  }

  /**
   * Retrieve user by id
   * @param userId The user id to retrieve
   */
  async #retrieve(userId: string): Promise<T> {
    return await this.#modelService.get<T>(this.#cls, userId);
  }

  /**
   * Convert identity to a principal
   * @param ident The registered identity to resolve
   */
  async #resolvePrincipal(ident: RegisteredPrincipal): Promise<RegisteredPrincipal> {
    const user = await this.#retrieve(ident.id);
    return this.toPrincipal(user);
  }

  /**
   * Authenticate password for model id
   * @param userId The user id to authenticate against
   * @param password The password to authenticate against
   */
  async #authenticate(userId: string, password: string): Promise<RegisteredPrincipal> {
    const ident = await this.#resolvePrincipal({ id: userId, details: {} });

    const hash = await AuthModelUtil.generateHash(password, ident.salt!);
    if (hash !== ident.hash) {
      throw new AuthenticationError('Invalid password');
    } else {
      delete ident.password;
      return ident;
    }
  }

  async postConstruct(): Promise<void> {
    if (isStorageSupported(this.#modelService) && Runtime.dynamic) {
      await this.#modelService.createModel?.(this.#cls);
    }
  }

  /**
   * Register a user
   * @param user The user to register
   */
  async register(user: OptionalId<T>): Promise<T> {
    const ident = this.toPrincipal(user);

    try {
      if (ident.id) {
        await this.#retrieve(ident.id);
        throw new AuthenticationError('That id is already taken.', { category: 'data' });
      }
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    }

    const fields = await AuthModelUtil.generatePassword(ident.password!);

    ident.password = undefined; // Clear it out on set

    Object.assign(user, this.fromPrincipal(fields));

    const res: T = await this.#modelService.create(this.#cls, user);
    return res;
  }

  /**
   * Change a password
   * @param userId The user id to affect
   * @param password The new password
   * @param oldPassword The old password
   */
  async changePassword(userId: string, password: string, oldPassword?: string): Promise<T> {
    const user = await this.#retrieve(userId);
    const ident = this.toPrincipal(user);

    if (oldPassword === ident.resetToken) {
      if (ident.resetExpires && ident.resetExpires.getTime() < Date.now()) {
        throw new AuthenticationError('Reset token has expired', { category: 'data' });
      }
    } else if (oldPassword !== undefined) {
      const pw = await AuthModelUtil.generateHash(oldPassword, ident.salt!);
      if (pw !== ident.hash) {
        throw new AuthenticationError('Old password is required to change');
      }
    }

    const fields = await AuthModelUtil.generatePassword(password);
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

    ident.resetToken = await AuthModelUtil.generateHash(Util.uuid(), salt, 25000, 32);
    ident.resetExpires = TimeUtil.fromNow(1, 'h');

    Object.assign(user, this.fromPrincipal(ident));

    await this.#modelService.update(this.#cls, user);

    return ident;
  }

  /**
   * Authorize principal into known user
   * @param principal
   * @returns Authorized principal
   */
  authorize(principal: RegisteredPrincipal): Promise<RegisteredPrincipal> {
    return this.#resolvePrincipal(principal);
  }

  /**
   * Authenticate entity into a principal
   * @param payload
   * @returns Authenticated principal
   */
  authenticate(payload: T): Promise<RegisteredPrincipal> {
    const { id, password } = this.toPrincipal(payload);
    return this.#authenticate(id, password!);
  }
}