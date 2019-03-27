import { Identity } from '@travetto/auth';

export interface RegisteredIdentity extends Identity {
  hash: string;
  salt: string;
  resetToken: string;
  resetExpires: Date;
  password?: string;
}
