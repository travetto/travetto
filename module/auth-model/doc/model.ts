import type { RegisteredPrincipal } from '@travetto/auth-model';
import { Model } from '@travetto/model';
import type { UnknownRecord } from '@travetto/runtime';

@Model()
export class User implements RegisteredPrincipal {
  id: string;
  source: string;
  details: UnknownRecord;
  password?: string;
  salt: string;
  hash: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions: string[];
}
