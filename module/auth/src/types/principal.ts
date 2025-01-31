import { AnyMap } from '@travetto/runtime';

/**
 * A user principal, including permissions and details
 * @augments `@travetto/rest:Context`
 * @concrete ../internal/types#PrincipalTarget
 */
export interface Principal<D = AnyMap> {
  /**
   * Primary identifier for a user
   */
  readonly id: string;
  /**
   * Unique identifier for the principal's lifecycle
   */
  readonly sessionId?: string;
  /**
   * Date of expiration
   */
  expiresAt?: Date;
  /**
   * Date of issuance
   */
  issuedAt?: Date;
  /**
   * The source of the issuance
   */
  readonly issuer?: string;
  /**
   * Supplemental details
   */
  readonly details: D;
  /**
   * List of all provided permissions
   */
  readonly permissions?: string[];
}