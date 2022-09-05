import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import { Authenticator, Authorizer, Principal } from '@travetto/auth';
import { PassportAuthenticator } from '@travetto/auth-passport';

export class FbUser {
  username: string;
  roles: string[];
}

export const FB_AUTH = Symbol.for('auth_facebook');

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookPassport(): Authenticator {
    return new PassportAuthenticator('facebook',
      new FacebookStrategy(
        {
          clientID: '<appId>',
          clientSecret: '<appSecret>',
          callbackURL: 'http://localhost:3000/auth/facebook/callback',
          profileFields: ['id', 'username', 'displayName', 'photos', 'email'],
        },
        (accessToken, refreshToken, profile, cb) =>
          cb(undefined, profile)
      ),
      (user: FbUser) => ({
        id: user.username,
        permissions: user.roles,
        details: user
      })
    );
  }

  @InjectableFactory()
  static principalSource(): Authorizer {
    return new class implements Authorizer {
      async authorize(p: Principal) {
        return p;
      }
    }();
  }
}