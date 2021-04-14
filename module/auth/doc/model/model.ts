import { Model, BaseModel } from '@travetto/model';
import { RegisteredPrincipal } from '@travetto/auth';

@Model()
export class User extends BaseModel implements RegisteredPrincipal {
  source: string;
  details: Record<string, unknown>;
  password?: string;
  salt: string;
  hash: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions: string[];
}