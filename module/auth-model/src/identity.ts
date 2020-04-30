import { Identity } from '@travetto/auth';

/**
 * An identity that can be created/registered
 */
export interface RegisteredIdentity extends Identity {
  hash: string;
  salt: string;
  resetToken: string;
  resetExpires: Date;
  password?: string;
}
