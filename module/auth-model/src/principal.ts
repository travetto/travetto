import { Principal } from '@travetto/auth';

/**
 * An principal that can be created/registered
 */
export interface RegisteredPrincipal extends Principal {
  /**
   * Password hash
   */
  hash?: string;
  /**
   * Password salt
   */
  salt?: string;
  /**
   * Temporary Reset Token
   */
  resetToken?: string;
  /**
   * End date for the reset token
   */
  resetExpires?: Date;
  /**
   * The actual password, only used on password set/update
   */
  password?: string;
}
