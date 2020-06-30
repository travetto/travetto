# Passport Auth
## Passport authentication integration support for the travetto framework

**Install: @travetto/auth-passport**
```bash
npm install @travetto/auth-passport
```

Within the node ecosystem, the most prevalent auth framework is [passport](http://passportjs.org).  With countless integrations, the desire to leverage as much of it as possible, is extremely high. To that end, this module provides support for [passport](http://passportjs.org) baked in. Registering and configuring a [passport](http://passportjs.org) strategy is fairly straightforward.

**Code: Sample Facebook/passport config**
```typescript
import { Strategy as FacebookStrategy } from 'passport-facebook';

import { InjectableFactory } from '@travetto/di';
import { PrincipalSource, Identity } from '@travetto/auth';
import { IdentitySource } from '@travetto/auth-rest';

import { PassportIdentitySource } from '@travetto/auth-passport';

export class FbUser {
  username: string;
  roles: string[];
}

export const FB_AUTH = Symbol.for('auth_facebook');

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
```

As you can see, [PassportIdentitySource](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module/auth-passport/src/identity.ts#L14) will take care of the majority of the work, and all that is required is:
   
   *  Provide the name of the strategy (should be unique)
   *  Provide the strategy instance. **Note**: you will need to provide the callback for the strategy to ensure you pass the external principal back into the framework
   *  The conversion functions which defines the mapping between external and local identities.

After that, the provider is no different than any other, and can be used accordingly.  Additionally, because [passport](http://passportjs.org) runs first, in it's entirety, you can 
use the provider as you normally would any [passport](http://passportjs.org) middleware.

**Code: Sample routes using Facebook/passport provider**
```typescript
import { Controller, Get, Redirect, Post, Request } from '@travetto/rest';
import { Authenticate, Authenticated, Unauthenticated } from '@travetto/auth-rest';

import { FB_AUTH } from './conf';

@Controller('/auth')
export class SampleAuth {

  @Get('/name')
  async getName() {
    return { name: 'bob' };
  }

  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin() {

  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth;
  }

  @Get('/facebook/callback')
  @Authenticate(FB_AUTH)
  async fbLoginComplete() {
    return new Redirect('/auth/self', 301);
  }

  @Post('/logout')
  @Unauthenticated()
  async logout(req: Request) {
    await req.logout();
  }

  /**
   * Simple Echo
   */
  @Post('/')
  async echo(req: Request): Promise<Record<string, any>> {
    return req.body;
  }
}
```

