travetto: Auth
===

**Install: primary**
```bash
$ npm install @travetto/auth
```

This module provides the high-level backdrop for managing security principals.  The goal of this module is to be a centralized location for various security frameworks to plug into.  The primary contributions are:
* Interfaces for standard security primitives
* Patterns for producing a [`Principal`](./src/principal.ts)
* Common security-related utilities for:
  * Checking permissions
  * Generating passwords

## Interfaces / Primitives
The module's goal is to be as flexible as possible.  To that end, the primary contract that this module defines, is that of the [`AuthContext`](./src/context.ts).

**Code: Auth context structure**
```typescript
export interface AuthContext<P extends Principal, I extends Identity> {
  id: string;
  permissions: Set<string>;
  identity: I;
  principal?: P;
}
```

As referenced above, a [`Principal`](./src/types.ts) is defined as a user with respect to a security context.  This is generally understood to be the information that the application knows about a user, specifically the configuration the application has about a user.

Comparatively, [`Identity`](./src/types.ts) is defined as an authenticated user session that can be provided by the application or derived from some other source.  In simpler systems the identity will be equal to the principal, but in systems where you support 3rd party logins (e.g. Google/Facebook/Twitter/etc.) your identity will be external to the system.

Overall, the structure is simple, but drives home the primary use cases of the framework.  The goals are
* Be able to identify a user uniquely
* To have a reference to a user's set of permissions
* To have access to the raw principal
* To have access to the raw identity

## Customization
By default, the module does not provide an implementation for the [`PrincipalProvider`](./src/principal.ts). By default the structure of the provider can be boiled down to:

**Code: Principal Provider**
```typescript
export abstract class PrincipalProvider {
  get autoCreate() { return false; }
  createPrincipal?(principal: Principal): Promise<Principal>;
  abstract resolvePrincipal(ident: Identity): Promise<Principal>;
}
```

The provider only requires one method to be defined, and that is `resolvePrincipal`.  This method receives an identity as an input, and is responsible for converting that to a principal (external user to internal user).  If you want to be able to auto-provision users from a remote source, you can set `autoCreate` to true, and supply `createPrincipal`'s functionality for storing the user as well.

The [`Auth-Model`](https://github.com/travetto/travetto/tree/master/module/auth-model) module is a good example of a principal provider that is also an identity source.  This is a common use case for simple internal auth.

## Common Utilities
The [`AuthUtil`](./src/util.ts) provides the following functionality:

**Code: Auth util structure**
```typescript
class AuthUtil {
  static async generateHash(password: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256'): Promise<string>;
  static async generatePassword(password: string, saltlen = 32): Promise<string>
  static permissionSetChecker(include: PermSet, exclude: PermSet, matchAll = true): (permissions: Set<string>) => boolean;
```

`permissionSetChecker` is probably the only functionality that needs to be explained. The function operates in a `DENY/ALLOW` mode.  This means that a permission check will succeed only if:
* The user is logged in
* If `matchAll` is false: 
  * The user does not have any permissions in the exclusion list
  * The include list is empty, or the user has at least one permission in the include list. 
* Else
  * The user does not have all permissions in the exclusion list
  * The include list is empty, or the user has all permissions in the include list. 

