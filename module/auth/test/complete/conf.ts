import { InjectableFactory } from '@travetto/di';
import { AuthPassportProvider } from '../../support/extension.passport/provider';
import { PrincipalConfig } from '../../src';

import { Strategy as FacebookStrategy } from 'passport-facebook';
import { AuthProvider } from '../../support/extension.express/provider';

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
          clientID: '914464648748805',
          clientSecret: '9740ebfa8b78f13042de7debf887b3e6',
          callbackURL: 'http://localhost:3000/auth/facebook/callback',
          profileFields: ['id', 'displayName', 'photos', 'email']
        },
        (accessToken, refreshToken, profile, cb) => {
          return cb(undefined, FbUser.from(profile));
        }
      ),
      new PrincipalConfig(FbUser, {
        id: 'id',
        permissions: 'roles'
      })
    );
  }
}