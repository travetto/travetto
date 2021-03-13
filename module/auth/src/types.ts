import { AuthContext } from './context';

/**
 * A user principal, including permissions and details, does not imply
 * authentication
 */
export interface Principal<D = unknown> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: D;
  /**
   * Date of expiration
   */
  expires?: Date;
}

/**
 * A principal that has been authenticated by an identity source
 */
export interface Identity extends Principal {
  /**
   * The source of the identity verification
   */
  source: string;
}

/**
 * Definition of a principal source, authorizers an identity into a principal
 *
 * @concrete ./internal/types:PrincipalSourceTarget
 */
export interface PrincipalSource {
  authorize(ident: Identity): Promise<AuthContext>;
}