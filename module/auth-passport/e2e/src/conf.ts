import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import { IdentityProvider } from '@travetto/auth-rest';

import { PassportIdentityProvider } from '../../';

export class FbUser {
  id: string;
  roles: string[];
}

export const FB_AUTH = Symbol('facebook');

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookPassport(): IdentityProvider {
    return new PassportIdentityProvider('facebook',
      new FacebookStrategy(
        {
          clientID: '<clientId>',
          clientSecret: '<clientSecret>',
          callbackURL: 'http://localhost:3000/auth/facebook/callback',
          profileFields: ['id', 'displayName', 'photos', 'email'],
        },
        (accessToken, refreshToken, profile, cb) => {
          return cb(undefined, profile);
        }
      ),
      (user: FbUser) => ({
        id: user.id,
        permissions: new Set(user.roles),
        details: {}
      })
    );
  }
}