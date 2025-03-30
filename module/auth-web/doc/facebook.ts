import { InjectableFactory } from '@travetto/di';

import { SimpleAuthenticator } from './source.ts';

export const FbAuthSymbol = Symbol.for('auth-facebook');

export class AppConfig {
  @InjectableFactory(FbAuthSymbol)
  static facebookIdentity() {
    return new SimpleAuthenticator();
  }
}