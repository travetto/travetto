import { Model, BaseModel } from '@travetto/model';
import { Address } from './address';

/**
 * Core User Model
 */
@Model()
export class User extends BaseModel {

  accessType?: 'user' | 'company' | 'admin';
  status?: 'Active' | 'Disabled' | 'Locked' | 'Reset';
  password?: string;
  activated?: boolean;
  hash?: string;
  salt?: string;
  resetToken?: string;
  resetExpires?: Date;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: Address;
  permissions: string[];

  prePersist() {
    delete this.password; // Do not allow this to be saved;
    super.prePersist();
  }
}