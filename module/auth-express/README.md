travetto: Auth Express
===

This is a primary integration for the [`Auth`](https://github.com/travetto/auth) module.  This is another level of scaffolding allowing for any [`express`](https://expressjs.com)-based authentication framework to integrate.  

The integration with the [`Express`](https://github.com/travetto/express) touches multiple levels. Primarily:
* Security information management
* Patterns for auth framework integrations
* Route declaration
* Passport integration

## Security information management
When working with framework's authentication, the user information is exposed via the `express` ```Request``` object.  The auth functionality is exposed on the request as the property `auth`.
```typescript
declare module "express" {
	export interface Request {
		auth: {
      context: AuthContext<any>; 
      authenticated: boolean;
      unauthenticated: boolean;
      checkPermissions(include: string[], exclude: string[]): boolean;
      login(providers: symbol[]): Promise<void>;
      logout: Promise<void>;
    }
	}
}
```
This allows for any filters/middleware to access this information without deeper knowledge of the framework itself.  Also, for performance benefits, the auth context is stored in the user session as a means to minimize future lookups. Since we are storing the entire principal in the session, it is best to keep the principal as small as possible.

## Patterns for Integration


## Route Declaration
Like the ```AuthService```, there are common auth patterns that most users will implement. The framework has codified these into decorators that a developer can pick up and use.

* ```@Authenticated``` provides `express` middleware that will authenticate the user as defined by the specified providers, or throw an error if authentication is unsuccessful.
```typescript
@Controller('/auth')
export class Auth {

  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin() {}

  ...

}
```
* ```@Authenticated``` and ```@Unauthenticated``` will simply enforce whether or not a user is logged in and throw the appropriate error messages as needed.
```typescript
@Controller('/auth')
export class Auth {
  ...

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth.context;
  }

  @Post('/logout')
  @Unauthenticated()
  async logout(req: Request, res: Response) {
    await req.auth.logout();
  }
```


The supported strategies off hand are:
  - `Model` service
  - `Crowd` authentication