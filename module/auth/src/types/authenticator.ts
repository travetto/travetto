import { Principal } from './principal';

/**
 * Authenticator context
 */
export interface AuthenticatorContext<I = unknown, R = unknown> {
  /**
   * The input data used to authenticate
   */
  input: I;

  /**
   * The request data, allows for deeper integration in certain auth flows
   */
  request: R;

  /**
   * Finalize the principal
   */
  finalize<P extends Principal>(principal: P): P | Promise<P>;
}

/**
 * Supports validation payload of type T into an authenticated principal
 *
 * @concrete ../internal/types#AuthenticatorTarget
 */
export interface Authenticator<I = unknown, R = unknown> {
  /**
   * Verify the payload, ensuring the payload is correctly identified.
   *
   * @returns Valid principal if authenticated
   * @returns undefined if authentication is valid, but incomplete (multi-step)
   * @throws AppError if authentication fails
   */
  authenticate(ctx: AuthenticatorContext<I, R>): Promise<Principal | undefined> | Principal | undefined;
}
