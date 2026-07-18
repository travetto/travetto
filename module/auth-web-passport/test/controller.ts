import type { Authenticator } from '@travetto/auth';
import { Login } from '@travetto/auth-web';
import { PassportAuthenticator } from '@travetto/auth-web-passport';
import { InjectableFactory } from '@travetto/di';
import { castTo } from '@travetto/runtime';
import { Controller, Post } from '@travetto/web';

const LOGIN = Symbol();

@Controller('/auth')
export class LoginTestController {
  @InjectableFactory()
  static config(): Authenticator {
    return new PassportAuthenticator(
      'local',
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
  async login() {}
}
