import { InjectableFactory } from '@travetto/di';
import { SimpleIdentitySource } from './source';

export const FB_AUTH = Symbol.for('auth-facebook');

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookIdentity() {
    return new SimpleIdentitySource();
  }
}