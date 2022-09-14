import { Principal } from './principal';

/**
 * Supports validation payload of type T into an authenticated principal
 *
 * @concrete ../internal/types:AuthenticatorTarget
 */
export interface Authenticator<T = unknown, P extends Principal = Principal, C = unknown> {
  /**
   * Verify the payload, ensuring the payload is correctly identified.
   *
   * @returns Valid principal if authenticated
   * @returns undefined if authentication is valid, but incomplete (multi-step)
   * @throws AppError if authentication fails
   */
  authenticate(payload: T, ctx?: C): Promise<P | undefined> | P | undefined;
}
