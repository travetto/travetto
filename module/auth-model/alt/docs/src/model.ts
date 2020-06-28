import { Model, BaseModel } from '@travetto/model';
import { RegisteredIdentity } from '../../../src/identity';

@Model()
export class User extends BaseModel implements RegisteredIdentity {
  id: string;
  source: string;
  details: Record<string, any>;
  password?: string;
  salt: string;
  hash: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions: string[];
}