import { AuthContext } from './context';

/**
 * A user principal, including permissions and details, does not imply
 * authentication
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Principal<D = any> {
  /**
   * Primary identifier for a user
   */
  id: string;
  /**
   * List of all provided permissions
   */
  permissions: string[];
  /**
   * Supplemental details
   */
  details: D;
  /**
   * Date of expiration
   */
  expiresAt?: Date;
  /**
   * Date of issuance
   */
  issuedAt?: Date;
}

/**
 * A principal that has been authenticated by an identity source
 */
export interface Identity extends Principal {
  /**
   * The source of the identity verification
   */
  issuer: string;
}

/**
 * Definition of a principal source, authorizers an identity into a principal
 *
 * @concrete ./internal/types:PrincipalSourceTarget
 */
export interface PrincipalSource {
  authorize(ident: Identity): Promise<AuthContext>;
}