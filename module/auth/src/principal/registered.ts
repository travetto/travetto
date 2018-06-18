import { PrincipalConfig } from './base';

export abstract class RegisteredPrincipalConfig<T = any> extends PrincipalConfig<T> {
  abstract get hashField(): keyof T;
  abstract get saltField(): keyof T;
  abstract get resetTokenField(): keyof T;
  abstract get resetExpiresField(): keyof T;

  getHash = (o: T) => this.lookup(o, this.hashField);
  getSalt = (o: T) => this.lookup(o, this.saltField);
  getResetToken = (o: T) => this.lookup(o, this.resetTokenField);
  getResetExpires = (o: T) => this.lookup(o, this.resetExpiresField);
}