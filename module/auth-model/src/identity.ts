import { Identity } from '@travetto/auth';

/**
 * An identity that can be created/registered
 */
export interface RegisteredIdentity extends Identity {
  /**
   * Password hash
   */
  hash: string;
  /**
   * Password salt
   */
  salt: string;
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
