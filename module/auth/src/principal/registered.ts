import { PrincipalConfig, PrincipalFields } from './base';
import { Class } from '@travetto/registry';

export interface RegisteredPrincipalFields<T> extends PrincipalFields<T> {
  hash: keyof T;
  salt: keyof T;
  resetToken: keyof T;
  resetExpires: keyof T;
}

export class RegisteredPrincipalConfig<T = any> extends PrincipalConfig<T, RegisteredPrincipalFields<T>> {
  constructor(type: Class<T>, fields: RegisteredPrincipalFields<T>) {
    super(type, fields);
  }

  getHash = (o: T) => this.lookup(o, this.fields.hash);
  getSalt = (o: T) => this.lookup(o, this.fields.salt);
  getResetToken = (o: T) => this.lookup(o, this.fields.resetToken);
  getResetExpires = (o: T) => this.lookup(o, this.fields.resetExpires);
}