travetto: Auth
===

This module provides the high-level backdrop for managing security principals.  The goal of this module is to be a centralized location for various security frameworks to plug into.  The primary contributions are:
* Interfaces for standard security primitives
* Principal configuration
* Centralized service for accessing, and testing the security principal
* Common security-related utilities

## Interfaces / Primitives
The module's goal is to be as flexible as possible.  To that end, the primary contract that this module defines, is that of the [`AuthContext`](./src/types.ts).
```typescript
export interface AuthContext<U> {
  id: string;
  permissions: Set<string>;
  principal: U;
}
```
The structure is simple, but drives home the primary use cases of the framework.  The goals are"
* Be able to identify a user uniquely
* To have a reference to a user's set of permissions
* To have access to the raw principal

This is the only contract that needs to be satisfied to be able to integrate a security framework.  Additionally, there are a series of error messages that should be standardized across error handling. These messages help to provide a consistent experience at the sub module level, and to mask some of the external framework's machinations.

## Principal Configuration
Additionally, there exists a common practice of mapping various external security principals into a local contract. These external principals, as provided from countless authentication schemes, need to be homogeonized for use.  This has been handled in other frameworks by using external configuration, and creating a mapping between the two set of fields.  Within this framework, we leverage `typescript`'s power to enforce the configuration via code.  This requires that there is a type to describe the external principal. At that point, we are ready to define our mapping:
```typescript
class ExternalUser {
  id: string;
  perms: Set<string>;
}

const config = new PrincipalConfig(ExternalUser, {
  id: 'id',
  permissions: 'perms'
});
```
At this point, the config is now type-checked against the ```ExternalUser``` class, such that passing in bad field names will throw a compile-time error.  With the configuration established, a programmer can now invoke:
```typescript
const context:AuthContext<ExternalUser> = config.toContext(externalPrincipal);
```
And now the context is established.

## Centralized Auth Services
Given the above contract definitions, the next step is to provide a localized place for interacting with the security principal for a given set of operations.  Again, with a desire to be flexible, the `AuthService` is as simple as possible:
```typescript
class AuthService<U> {

  context:AuthContext<U>;
  readonly authenticated:boolean;
  readonly unauthenticated:boolean;

  clearContext():void;
  checkPermissions(include: string[], exclude: string[]);
}
```
The context can be read/set and will be backed by the [`Context`](https://github.com/travetto/context) module.  This provides access to the security principal through an entire call chain, asynchronous or other-wise.  This is also leveraged by the [`Auth-Express`](https://github.com/travetto/auth-express) module to keep the security context available throughout the entire request.

```checkPermissions``` is probably the only functionality that needs to be explained. The function operates in a `DENY/ALLOW` mode.  This means that a permission check will succeed only if:
* The user is logged in
* The user does not have any permissions in the exclusion list
* The include list is empty, or the user has at least one permission in the include list. 

## Common Utilities
The [```AuthUtil```](./src/util.ts) provides the following functionality:
```typescript
class AuthUtil {
  static async generateHash(password: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256'): Promise<string>;
  static async generateSalt(saltlen = 32): Promise<string>;
  static async generatePassword(password: string, saltlen = 32, validator?: (password: string) => Promise<boolean>): Promise<string>
```
The functionality above is aimed at password generation/management, but the functionality with grow over time as more sub modules are added.

The officially supported auth modules are:
  - [`Auth-Model`](https://github.com/travetto/auth-model) integration between this module and the [`Model`](https://github.com/travetto/model) module.
  - [`Auth-Express`](https://github.com/travetto/auth-express) integration between this module and the [`Express`](https://github.com/travetto/express) module.
  - [`Auth-Passport`](https://github.com/travetto/auth-passport) integration between this module and [`passport`](http://passportjs.org);