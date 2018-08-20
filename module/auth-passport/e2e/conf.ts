import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import { PrincipalConfig } from '@travetto/auth';
import { AuthProvider } from '@travetto/auth-rest';

import { AuthPassportProvider } from '../src';

export class FbUser {
  id: string;
  roles: string[];
}

export const FB_AUTH = Symbol('facebook');

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookPassport(): AuthProvider<any> {
    return new AuthPassportProvider('facebook',
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
      new PrincipalConfig(FbUser, {
        id: 'id',
        permissions: 'roles'
      })
    );
  }
}