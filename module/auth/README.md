travetto: Auth
===

**NOTE** WIP, auth is being rewritten from `passport` to a simpler set of code.

This module provides general authentication/security handling. This handles standard patterns for
login, registration, permission checking, 
  
  - `@Authenticated` for when a user is logged in
  - `@Unauthenticated` for when a user is logged out
  - `@Authenticate` for applying an authentication strategy

The supported strategies off hand are:
  - `Model` service
  - `Crowd` authentication