import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import type { Authenticator, Authorizer, Principal } from '@travetto/auth';
import { PassportAuthenticator } from '@travetto/auth-web-passport';

export class FbUser {
  username: string;
  permissions: string[];
}

export const FbAuthSymbol = Symbol.for('auth_facebook');

export class AppConfig {
  @InjectableFactory(FbAuthSymbol)
  static facebookPassport(): Authenticator {
    return new PassportAuthenticator('facebook',
      new FacebookStrategy(
        {
          clientID: '<appId>',
          clientSecret: '<appSecret>',
          callbackURL: 'http://localhost:3000/auth/facebook/callback',
          profileFields: ['id', 'username', 'displayName', 'photos', 'email'],
        },
        (accessToken, refreshToken, profile, callback) =>
          callback(undefined, profile)
      ),
      (user: FbUser) => ({
        id: user.username,
        permissions: user.permissions,
        details: user
      })
    );
  }

  @InjectableFactory()
  static principalSource(): Authorizer {
    return new class implements Authorizer {
      async authorize(principal: Principal) {
        return principal;
      }
    }();
  }
}