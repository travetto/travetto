# Rest Auth
## Rest authentication integration support for the travetto framework

**Install: @travetto/auth-rest**
```bash
npm install @travetto/auth-rest
```

This is a primary integration for the [Authentication](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth "Authentication scaffolding for the travetto framework") module.  This is another level of scaffolding allowing for compatible authentication frameworks to integrate.  

The integration with the [RESTful API](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest "Declarative api for RESTful APIs with support for the dependency injection module.") module touches multiple levels. Primarily:

   
   *  Security information management
   *  Patterns for auth framework integrations
   *  Route declaration

## Security information management
When working with framework's authentication, the user information is exposed via the [Request](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest/src/types.d.ts#L11) 
object.  The auth functionality is exposed on the request as the property `auth`.

**Code: Structure of auth property on the request**
```typescript
export interface Request {
      /**
       * The auth context
       */
      auth: AuthContext;
      /**
       * The login context
       */
      loginContext?: Record<string, any>;
      /**
       * Log the user out
       */
      logout(): Promise<void>;
      /**
       * Perform a login
       * @param providers  List of providers to authenticate against
       */
      login(providers: symbol[]): Promise<AuthContext | undefined>; // Undefined is for multi step logins
    }
```

This allows for any filters/middleware to access this information without deeper knowledge of the framework itself.  Also, for performance benefits, the auth context can be stored in the user session as a means to minimize future lookups. If storing the entire principal in the session, it is best to keep the principal as small as possible.

When authenticating, with a multi-step process, it is useful to share information between steps.  The `loginContext` property is intended to be a location in which that information is persisted. Currently only the [Passport Auth](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth-passport "Passport authentication integration support for the travetto framework") module uses this, when dealing with multi-step logins.

## Patterns for Integration
Every external framework integration relies upon the [IdentitySource](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth-rest/src/identity.ts#L7) contract.  This contract defines the boundaries between both frameworks and what is needed to pass between. As stated elsewhere, the goal is to be as flexible as possible, and so the contract is as minimal as possible:

**Code: Structure for the Identity Source**
```typescript
import { Request, Response } from '@travetto/rest';
import { Identity } from '@travetto/auth';

/**
 * Identity source to support authentication
 */
export abstract class IdentitySource {
  /**
   * Verify the information from the request, authenticate into an Identity
   *
   * @param req The travetto request
   * @param res The travetto response
   */
  abstract async authenticate(req: Request, res: Response): Promise<Identity | undefined>;
}
```

The only required method to be defined is the `authenticate` method.  This takes in a [Request](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest/src/types.d.ts#L11) and [Response](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest/src/types.d.ts#L87), and is responsible for:

   
   *  Returning an [Identity](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth/src/types.ts#L26) if authentication was successful
   *  Throwing an error if it failed
   *  Returning undefined if the authentication is multi-staged and has not completed yet
A sample auth provider would look like:

**Code: Sample Identity Source**
```typescript
import { Response, Request } from '@travetto/rest';
import { AppError } from '@travetto/base';

import { IdentitySource } from '@travetto/auth-rest/src/identity';

export class SimpleIdentitySource extends IdentitySource {
  async authenticate(req: Request, res: Response) {
    const { username, password } = req.body;
    if (username === 'test' && password === 'test') {
      return {
        id: 'test',
        source: 'simple',
        permissions: [],
        details: {
          username: 'test'
        }
      };
    } else {
      throw new AppError('Invalid credentials', 'authentication');
    }
  }
}
```

The provider must be registered with a custom symbol to be used within the framework.  At startup, all registered [IdentitySource](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth-rest/src/identity.ts#L7)'s are collected and stored for reference at runtime, via symbol. For example:

**Code: Potential Facebook provider**
```typescript
import { InjectableFactory } from '@travetto/di';
import { SimpleIdentitySource } from './source';

export const FB_AUTH = Symbol.for('auth-facebook');

export class AppConfig {
  @InjectableFactory(FB_AUTH)
  static facebookIdentity() {
    return new SimpleIdentitySource();
  }
}
```

The symbol `FB_AUTH` is what will be used to reference providers at runtime.  This was chosen, over `class` references due to the fact that most providers will not be defined via a new class, but via an [@InjectableFactory](https://github.com/travetto/travetto/tree/1.0.0-dev/module/di/src/decorator.ts#L72) method.

## Route Declaration
Like the [AuthService](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth-rest/src/auth.ts#L14), there are common auth patterns that most users will implement. The framework has codified these into decorators that a developer can pick up and use.

[Authenticate](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth-rest/src/decorator.ts#L10) provides middleware that will authenticate the user as defined by the specified providers, or throw an error if authentication is unsuccessful.

**Code: Using provider with routes**
```typescript
import { Controller, Get, Redirect, Request } from '@travetto/rest';

import { Authenticate, Authenticated } from '@travetto/auth-rest';
import { FB_AUTH } from './facebook';

@Controller('/auth')
export class SampleAuth {

  @Get('/simple')
  @Authenticate(FB_AUTH)
  async simpleLogin() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth.principal;
  }

  @Get('/logout')
  @Authenticated()
  async logout(req: Request) {
    await req.logout();
    return new Redirect('/auth/self', 301);
  }
}
```

[Authenticated](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth-rest/src/decorator.ts#L20) and [Unauthenticated](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth-rest/src/decorator.ts#L35) will simply enforce whether or not a user is logged in and throw the appropriate error messages as needed. Additionally, [AuthContext](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth/src/context.ts#L11) is accessible via [@Context](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest/src/decorator/param.ts#L43) directly, without wiring in a request object, but is also accessible on the request object as [Request](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest/src/types.d.ts#L11).auth.
