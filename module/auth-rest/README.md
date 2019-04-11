travetto: Auth-Rest
===

**Install: auth support**
```bash
$ npm install @travetto/auth-rest
```

This is a primary integration for the [`Auth`](https://github.com/travetto/travetto/tree/master/module/auth) module.  This is another level of scaffolding allowing for compatible authentication frameworks to integrate.  

The integration with the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module touches multiple levels. Primarily:
* Security information management
* Patterns for auth framework integrations
* Route declaration

## Security information management
When working with framework's authentication, the user information is exposed via the `Request` object.  The auth functionality is exposed on the request as the property `auth`.

**Code: Structure of auth property on the request**
```typescript
export interface Request {
  auth: {
    identity: Identity | undefined;
    principal: Principal | undefined;
    principalDetails: U;
    permissions: string[];
    permissionSet: Set<string>;
    updatePrincipalDetails(details: U): Promise<void>;
    checkPermissions(include: Set<string>, exclude: Set<string>, matchAll = false): void; // Throws an error on exception
  }
  logout(): Promise<void>;
  login(providers: symbol[]): Promise<AuthContext | undefined>;
}
```

This allows for any filters/middleware to access this information without deeper knowledge of the framework itself.  Also, for performance benefits, the auth context can be stored in the user session as a means to minimize future lookups. If storing the entire principal in the session, it is best to keep the principal as small as possible.

## Patterns for Integration
Every external framework integration relies upon the `IdentityProvider` contract.  This contract defines the boundaries between both frameworks and what is needed to pass between. As stated elsewhere, the goal is to be as flexible as possible, and so the contract is as minimal as possible:

**Code: Structure for the AuthProvider**
```typescript
export abstract class IdentityProvider {
  // Undefined allows for multi step identification
  abstract async authenticate(req: Request, res: Response): Promise<Identity | undefined>;
}
```

The only required method to be defined is the `authenticate` method.  This takes in a `Request` and `Response`, and is responsible for:
* Returning an `Identity` if authentication was successful
* Throwing an error if it failed
* Returning undefined if the authentication is multi-staged and has not completed yet

A sample auth provider would look like:

**Code: Sample Dummy Provider**
```typescript
class DumbProvider extends Identity<any> {
  async authenticate(req: Request, res: Response) {
    const { username, password } = req.body;
    if (username === 'test' && password === 'test') {
      return {
        id: 'test',
        permissions: new Set(),
        details: {
          username: 'test'
        }
      };
    } else {
      throw new Error(ERR_INVALID_CREDS);
    }
  }
}
```

The provider must be registered with a custom symbol to be used within the framework.  At startup, all registered `IdentityProvider`s are collected and stored for reference at runtime, via symbol. For example:

**Code: Potential Facebook provider**
```typescript
export const FB_AUTH = Symbol('facebook');

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookProvider(): IdentityProvider<any> {
    return new IdentityProvider(...);
  }
}
```

The symbol `FB_AUTH` is what will be used to reference providers at runtime.  This was chosen, over `class` references due to the fact that most providers will not be defined via a new class, but via an `@InjectableFactory` method.

## Route Declaration
Like the `AuthService`, there are common auth patterns that most users will implement. The framework has codified these into decorators that a developer can pick up and use.

`@Authenticate` provides middleware that will authenticate the user as defined by the specified providers, or throw an error if authentication is unsuccessful.

**Code: Using provider with routes**
```typescript
@Controller('/auth')
export class Auth {

  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin() {}

  ...

}
```

`@Authenticated` and `@Unauthenticated` will simply enforce whether or not a user is logged in and throw the appropriate error messages as needed.

**Code: Showing standard user operations as routes**
```typescript
@Controller('/auth')
export class Auth {
  ...

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth.context;
  }

  @Get('/admin')
  @Authenticated(['admin'])
  async getAdminStuff(req: Request) {
    return req.auth.context;
  }

  @Post('/logout')
  @Unauthenticated()
  async logout(req: Request, res: Response) {
    await req.auth.logout();
  }
```