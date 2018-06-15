import { PrincipalProvider } from './base';

export abstract class RegisteredPrincipalProvider<T = any> extends PrincipalProvider<T> {
  abstract get hashField(): string;
  abstract get saltField(): string;
  abstract get resetTokenField(): string;
  abstract get resetExpiresField(): string;

  getHash = (o: T) => this.lookup(o, this.hashField);
  getSalt = (o: T) => this.lookup(o, this.saltField);
  getResetToken = (o: T) => this.lookup(o, this.resetTokenField);
  getResetExpires = (o: T) => this.lookup(o, this.resetExpiresField);
}