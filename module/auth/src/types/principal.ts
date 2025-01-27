import { AnyMap } from '@travetto/runtime';

/**
 * A user principal, including permissions and details
 * @concrete ../internal/types#PrincipalTarget
 * @augments `@travetto/rest:Context`
 */
export interface Principal<D = AnyMap> {
  /**
   * Primary identifier for a user
   */
  id: string;
  /**
   * Unique identifier for the principal's lifecycle
   */
  sessionId?: string;
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
  details: D;
  /**
   * List of all provided permissions
   */
  permissions?: string[];
}