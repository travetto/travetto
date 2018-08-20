travetto: Auth-Passport
===

Within the node ecosystem, the most prevalent auth framework is [`passport`](http://passportjs.org).  With countless integrations, the desire to leverage as much of it as possible, is extremely high. To that end, this module provides support for `passport` baked in, and registering and configuring a strategy is fairly straightforward.

```typescript
export const FB_AUTH = Symbol('facebook');

export class FbUser {
  id: string;
  roles: string[];
}

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
```

As you can see, ```AuthPassportProvider``` will take care of the majority of the work, and all that is required is:
* Provide the name of the strategy (should be unique)
* Provide the strategy instance. **NOTE** you will need to provide the callback for the strategy to ensure you pass the external principal back into the framework
* The ```PrincipalConfig``` which defines the mapping between external and local principals.

After that, the provider is no different than any other, and can be used accordingly.  Additionally, because passport runs first, in it's entirety, you can use the provider as you normally would any passport middleware.

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