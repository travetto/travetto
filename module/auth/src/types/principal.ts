/**
 * A user principal, including permissions and details
 *
 * @concrete ../internal/types:PrincipalTarget
 * @augments `@trv:rest/Context`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Principal<D = { [key: string]: any }> {
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
  details: D;
  /**
   * List of all provided permissions
   */
  permissions?: string[];
}