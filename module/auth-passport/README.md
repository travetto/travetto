travetto: Auth-Passport
===

**Install: passport provider**
```bash
$ npm install @travetto/auth-passport
```

Within the node ecosystem, the most prevalent auth framework is [`passport`](http://passportjs.org).  With countless integrations, the desire to leverage as much of it as possible, is extremely high. To that end, this module provides support for `passport` baked in. Registering and configuring a `passport` strategy is fairly straightforward.

**Code: Sample Facebook/passport config**
```typescript
export const FB_AUTH = Symbol('facebook');

export class FbUser {
  id: string;
  roles: string[];
}

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookPassport(): IdentityProvider {
    return new PassportIdentityProvider('facebook',
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
      (user: FbUser) => ({
        id: user.id,
        permissions: new Set(user.roles)
      })
    );
  }
}
```

As you can see, ```PassportIdentityProvider``` will take care of the majority of the work, and all that is required is:
* Provide the name of the strategy (should be unique)
* Provide the strategy instance. **NOTE** you will need to provide the callback for the strategy to ensure you pass the external principal back into the framework
* The conversion functions which defines the mapping between external and local identities.

After that, the provider is no different than any other, and can be used accordingly.  Additionally, because `passport` runs first, in it's entirety, you can use the provider as you normally would any passport middleware.

**Code: Sample routes using Facebook/passport provider**
```typescript
@Controller('/auth')
export class AppAuth {

  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin() {

  }

  @Get('/facebook/callback')
  @Authenticate(FB_AUTH)
  async fbLoginComplete() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth.context;
  }
}
```