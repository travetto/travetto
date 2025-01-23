import { Principal } from './principal';

/**
 * Supports validation payload of type I into an authenticated principal
 *
 * @concrete ../internal/types#AuthenticatorTarget
 */
export interface Authenticator<I = unknown, R = unknown, P extends Principal = Principal> {
  /**
   * Verify the payload, ensuring the payload is correctly identified.
   *
   * @returns Valid principal if authenticated
   * @returns undefined if authentication is valid, but incomplete (multi-step)
   * @throws AppError if authentication fails
   */
  authenticate(input: I, request?: R): Promise<P | undefined> | P | undefined;
}
