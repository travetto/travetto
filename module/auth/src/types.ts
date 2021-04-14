/**
 * A user principal, including permissions and details
 *
 * @concrete ./internal/types:PrincipalTarget
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Principal<D = any> {
  /**
   * Primary identifier for a user
   */
  id: string;
  /**
   * Date of expiration
   */
  expiresAt?: Date;
  /**
   * Date of issuance
   */
  issuedAt?: Date;
  /**
   * Max age in seconds a principal is valid
   */
  maxAge?: number;
  /**
   * The source of the issuance
   */
  issuer?: string;
  /**
   * Supplemental details
   */
  details?: D;
  /**
   * List of all provided permissions
   */
  permissions?: string[];
}

/**
 * Definition of an authorization source, which validates a principal into an authorized principal
 *
 * @concrete ./internal/types:AuthorizerTarget
 */
export interface Authorizer<P extends Principal = Principal> {
  /**
   * Authorize inbound principal, verifying it's permission to access the system.
   * @param principal
   * @returns New principal that conforms to the required principal shape
   */
  authorize(principal: Principal): Promise<P> | P;
}

/**
 * Supports validation payload of type T into an authenticated principal
 *
 * @concrete ./internal/types:AuthenticatorTarget
 */
export interface Authenticator<T = unknown, P extends Principal = Principal, C = unknown> {
  /**
   * Verify the payload, verifying the payload is correctly identified.
   * @returns Valid principal if authenticated
   * @returns undefined if authentication is valid, but incomplete (multi-step)
   * @throws AppError if authentication fails
   */
  authenticate(payload: T, ctx?: C): Promise<P | undefined> | P | undefined;
}