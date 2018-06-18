travetto: Auth
===

This module provides general authentication/security handling, with support for 
express via some key decorators for .  For example:
  
  - `@Authenticated` for when a user is logged in
  - `@Unauthenticated` for when a user is logged out
  - `@Authenticate` for applying an authentication strategy

The supported strategies off hand are:
  - `Model` service
  - `Crowd` authentication