import { InjectableFactory } from '@travetto/di';
import { PrincipalConfig } from '@travetto/auth';

import { AuthProvider } from '../../src';
import { AuthPassportProvider } from '../../extension/auth.passport';

import { Strategy as FacebookStrategy } from 'passport-facebook';

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
          clientID: '<clientId>',
          clientSecret: '<clientSecret>',
          callbackURL: 'http://localhost:3000/auth/facebook/callback',
          profileFields: ['id', 'displayName', 'photos', 'email']
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