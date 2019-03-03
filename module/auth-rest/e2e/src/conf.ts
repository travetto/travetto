import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import { PassportIdentityProvider } from '@travetto/auth-passport';

import { IdentityProvider } from '../..';

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
          clientID: '165936444084265',
          clientSecret: 'fd12224c46311b83349653733913a5f6',
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