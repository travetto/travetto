travetto: Auth
===

This module provides basic passport integration, as well some key decorators for 
handling some common use-cases.  For example:
  
  - `@Authenticated` for when a user is logged in
  - `@Unauthenticated` for when a user is logged out
  - `@Authenticate` for injecting a passport strategy

While this module does not depend on the Mongo module, it does support a simple local
strategy for Mongo.  It will only active if imported, and registered appropriately, but 
you must first list the mongo module as a dependency or you will get a compile time error.