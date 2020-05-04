import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import { PrincipalSource, Identity } from '@travetto/auth';
import { IdentitySource } from '@travetto/auth-rest';

import { PassportIdentitySource } from '../../';

export class FbUser {
  username: string;
  roles: string[];
}

export const FB_AUTH = Symbol('facebook');

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookPassport(): IdentitySource {
    return new PassportIdentitySource('facebook',
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
  static principalSource(): PrincipalSource {
    return new class extends PrincipalSource {
      async resolvePrincipal(ident: Identity) {
        return ident;
      }
    }();
  }
}