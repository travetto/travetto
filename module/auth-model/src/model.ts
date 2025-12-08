import { Util, Class, TimeUtil, castTo } from '@travetto/runtime';
import { ModelCrudSupport, ModelType, NotFoundError, OptionalId, ModelStorageUtil } from '@travetto/model';
import { Principal, Authenticator, Authorizer, AuthenticationError } from '@travetto/auth';

import { AuthModelUtil } from './util.ts';

/**
 * A set of registration data
 * @concrete
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

type ToPrincipal<T extends ModelType> = (item: OptionalId<T>) => RegisteredPrincipal;
type FromPrincipal<T extends ModelType> = (item: Partial<RegisteredPrincipal>) => Partial<T>;

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
   * @param identity The registered identity to resolve
   */
  async #resolvePrincipal(identity: RegisteredPrincipal): Promise<RegisteredPrincipal> {
    const user = await this.#retrieve(identity.id);
    return this.toPrincipal(user);
  }

  /**
   * Authenticate password for model id
   * @param userId The user id to authenticate against
   * @param password The password to authenticate against
   */
  async #authenticate(userId: string, password: string): Promise<RegisteredPrincipal> {
    const identity = await this.#resolvePrincipal({ id: userId, details: {} });

    const hash = await AuthModelUtil.generateHash(password, identity.salt!);
    if (hash !== identity.hash) {
      throw new AuthenticationError('Invalid password');
    } else {
      return identity;
    }
  }

  async postConstruct(): Promise<void> {
    if (ModelStorageUtil.shouldAutoCreate(this.#modelService)) {
      await this.#modelService.createModel?.(this.#cls);
    }
  }

  /**
   * Register a user
   * @param user The user to register
   */
  async register(user: OptionalId<T>): Promise<T> {
    const identity = this.toPrincipal(user);

    try {
      if (identity.id) {
        await this.#retrieve(identity.id);
        throw new AuthenticationError('That id is already taken.', { category: 'data' });
      }
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    const fields = await AuthModelUtil.generatePassword(identity.password!);
    const output: Partial<T> = { ...user, ...this.fromPrincipal(fields) };
    return await this.#modelService.create(this.#cls, this.#cls.from(castTo(output)));
  }

  /**
   * Change a password
   * @param userId The user id to affect
   * @param password The new password
   * @param oldPassword The old password
   */
  async changePassword(userId: string, password: string, oldPassword?: string): Promise<T> {
    const user = await this.#retrieve(userId);
    const identity = this.toPrincipal(user);

    if (oldPassword === identity.resetToken) {
      if (identity.resetExpires && identity.resetExpires.getTime() < Date.now()) {
        throw new AuthenticationError('Reset token has expired', { category: 'data' });
      }
    } else if (oldPassword !== undefined) {
      const oldPasswordHash = await AuthModelUtil.generateHash(oldPassword, identity.salt!);
      if (oldPasswordHash !== identity.hash) {
        throw new AuthenticationError('Old password is required to change');
      }
    }

    const fields = await AuthModelUtil.generatePassword(password);
    const output: Partial<T> = { ...user, ...this.fromPrincipal(fields) };
    return await this.#modelService.update(this.#cls, this.#cls.from(castTo(output)));
  }

  /**
   * Generate a reset token
   * @param userId The user to reset for
   */
  async generateResetToken(userId: string): Promise<RegisteredPrincipal> {
    const user = await this.#retrieve(userId);
    const identity = this.toPrincipal(user);
    const salt = await Util.uuid();

    identity.resetToken = await AuthModelUtil.generateHash(Util.uuid(), salt, 25000, 32);
    identity.resetExpires = TimeUtil.fromNow(1, 'h');

    const output: Partial<T> = { ...user, ...this.fromPrincipal(identity) };
    await this.#modelService.update(this.#cls, this.#cls.from(castTo(output)));
    return identity;
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