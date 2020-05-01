/**
 * A user principal, including permissions and details, does not imply
 * authentication
 */
export interface Principal {
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
  details: Record<string, any>;
  /**
   * Date of expiration
   */
  expires?: Date;
}

/**
 * A principal that has been authenticated by a provider
 */
export interface Identity extends Principal {
  /**
   * The source of the identity verification
   */
  provider: string;
}