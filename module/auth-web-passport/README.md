<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/auth-web-passport/DOC.tsx and execute "npx trv doc" to rebuild -->
# Web Auth Passport

## Web authentication integration support for the Travetto framework

**Install: @travetto/auth-web-passport**
```bash
npm install @travetto/auth-web-passport

# or

yarn add @travetto/auth-web-passport
```

This is a primary integration for the [Web Auth](https://github.com/travetto/travetto/tree/main/module/auth-web#readme "Web authentication integration support for the Travetto framework") module. 

Within the node ecosystem, the most prevalent auth framework is [passport](http://passportjs.org).  With countless integrations, the desire to leverage as much of it as possible, is extremely high. To that end, this module provides support for [passport](http://passportjs.org) baked in. Registering and configuring a [passport](http://passportjs.org) strategy is fairly straightforward.

**NOTE:** Given that [passport](http://passportjs.org) is oriented around [express](https://expressjs.com), this module relies on [Web Connect Support](https://github.com/travetto/travetto/tree/main/module/web-connect#readme "Web integration for Connect-Like Resources") as an adapter for the request/response handoff.  There are some limitations listed in the module, and those would translate to any [passport](http://passportjs.org) strategies that are being used.

**Code: Sample Facebook/passport config**
```typescript
import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import { Authenticator, Authorizer, Principal } from '@travetto/auth';
import { PassportAuthenticator } from '@travetto/auth-web-passport';

export class FbUser {
  username: string;
  permissions: string[];
}

export const FbAuthSymbol = Symbol.for('auth_facebook');

export class AppConfig {
  @InjectableFactory(FbAuthSymbol)
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
        permissions: user.permissions,
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
```

As you can see, [PassportAuthenticator](https://github.com/travetto/travetto/tree/main/module/auth-web-passport/src/authenticator.ts#L15) will take care of the majority of the work, and all that is required is:
   *  Provide the name of the strategy (should be unique)
   *  Provide the strategy instance.
   *  The conversion functions which defines the mapping between external and local identities.

**Note**: You will need to provide the callback for the strategy to ensure you pass the external principal back into the framework
After that, the provider is no different than any other, and can be used accordingly.  Additionally, because [passport](http://passportjs.org) runs first, in it's entirety, you can use the provider as you normally would any [passport](http://passportjs.org) middleware.

**Code: Sample endpoints using Facebook/passport provider**
```typescript
import { Controller, Get, Post, WebRequest, ContextParam, WebResponse } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { Principal } from '@travetto/auth';

import { FbAuthSymbol } from './conf.ts';

@Controller('/auth')
export class SampleAuth {

  @ContextParam()
  request: WebRequest;

  @ContextParam()
  user: Principal;

  @Get('/name')
  async getName() {
    return { name: 'bob' };
  }

  @Get('/facebook')
  @Login(FbAuthSymbol)
  async fbLogin() {

  }

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.user;
  }

  @Get('/facebook/callback')
  @Login(FbAuthSymbol)
  async fbLoginComplete() {
    return WebResponse.redirect('/auth/self');
  }

  @Post('/logout')
  @Logout()
  async logout() { }

  /**
   * Simple Echo
   */
  @Post('/')
  async echo(): Promise<unknown> {
    return this.request.body;
  }
}
```
