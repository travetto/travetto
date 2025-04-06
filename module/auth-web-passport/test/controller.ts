import { Login } from '@travetto/auth-web';
import { InjectableFactory } from '@travetto/di';
import { Controller, Post } from '@travetto/web';
import { Authenticator } from '@travetto/auth';
import { castTo } from '@travetto/runtime';

import { PassportAuthenticator } from '../src/authenticator.ts';

const LOGIN = Symbol();

@Controller('/auth')
export class LoginTestController {

  @InjectableFactory()
  static config(): Authenticator {
    return new PassportAuthenticator('local',
      {
        name: 'local',
        authenticate(req, options) {
          if ('letmein' in req.query) {
            return {};
          } else {
            throw new Error(`Unknown user ${req.query}`);
          }
        }
      },
      v => castTo(v)
    );
  }

  @Post('/user')
  @Login(LOGIN)
  async login() {

  }
}