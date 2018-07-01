import { Controller, Get } from '@travetto/express';
import { InjectableFactory } from '@travetto/di';

import { Request, Response } from 'express';

import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Authenticate } from '../../support/extension.express';
import { AuthPassportProvider } from '../../support/extension.passport/provider';
import { PrincipalConfig } from '../../src';

class FbUser {
  id: string;
  roles: string[];
}

const FB_AUTH = Symbol('facebook');

class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookPassport() {
    console.log('Aloha');
    return new AuthPassportProvider('facebook',
      new FacebookStrategy(
        {
          clientID: '914464648748805',
          clientSecret: '9740ebfa8b78f13042de7debf887b3e6',
          callbackURL: 'http://localhost:3000/auth/facebook/callback'
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

@Controller('/auth')
export class SampleAuth {
  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin(req: Request, res: Response) {

  }

  @Get('/facebook/callback')
  async fbLoginComplete(req: Request, res: Response) {
    return req.auth.context!;
  }
}