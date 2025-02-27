import { AnyMap } from '@travetto/runtime';
import { Principal } from './principal';

/**
 * Represents the general shape of additional login context, usually across multiple calls
 */
export interface AuthenticatorState extends AnyMap { }

/**
 * Supports validation payload of type T into an authenticated principal
 *
 * @concrete
 */
export interface Authenticator<T = unknown, C = unknown, P extends Principal = Principal> {
  /**
   * Retrieve the authenticator state for the given request
   */
  getState?(context?: C): Promise<AuthenticatorState | undefined> | AuthenticatorState | undefined;

  /**
   * Verify the payload, ensuring the payload is correctly identified.
   *
   * @returns Valid principal if authenticated
   * @returns undefined if authentication is valid, but incomplete (multi-step)
   * @throws AppError if authentication fails
   */
  authenticate(payload: T, context?: C): Promise<P | undefined> | P | undefined;
}
