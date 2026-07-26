# Travetto 1.0 Release Notes

> Release 1.0.0: 2020-07-04 -- Launch

### Breaking Changes
* *Provider / *Store classes have been renamed to *Source .  This to make the  sub-module model consistently named (Cache, Identity, Model)
* The AssetStore methods have been renamed to match the cache model, since they are basically the same thing
* Image manipulation is a new package and is no longer tied to the asset service
* The Email service has been simplified to only support mustache.
* The Email template service has been overhauled.  It is now a template compiler and there are command line tools to compile (watch and compile), and to the UI for development has been overhauled”
* Exec and Schedule  module have been removed
* The docker portion of Exec has been moved to the Command module
* The program execution part of Exec has been integrated into the boot module
* The Worker module has been simplified, and is only one worker input source now, (though others can be added)
* The Test  module now boasts a watchable test server, that will listen for changes in test files and automatically re-run them.  This is what is used to power the new plugin implementation.
* All ENV variables have been renamed from X to TRV_X  except for DEBUG, TRACE, and NODE_ENV
* The app module no longer supports isolated sub-apps, everything is always connected.
* The compiler  now knows about interfaces
* The compiler now is also able to infer return types, and so they should no longer be needed for DI and type checking
* Schema now supports simple types/interfaces for field definitions (also useful for SchemaQuery)
* The auto flag has been removed from the schema package
* Extensions files are now part of the barrel export, and will complain if used without the appropriate import.  E.g. import {SchemaQuery} from '@travetto/schema';
* The app cache is now located within the app directory as .trv_cache . Since the command line test run pre-compiles the tests, they use the same cache as well.
* Code transformation has been externalized to it's own module.

### Major Fixes
* Updated to Node v12 and Typescript 3.9.x as a minimum requirement
*
