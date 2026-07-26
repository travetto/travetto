# Travetto 7.1 Release Notes

> Release 7.1 - 2026-1-15

## Highlights
* Switched over to type only imports when possible, eslint updated to do the same
* Moved to an npx agnostic world (with initial support for PNPM)
* Reworked compiler bootstrapping
    * No longer manually compiling
    * Leveraging node's hooks to strip types for all ts files on load
    * Reworked all our entry points to utilize this
    * Transformers were updated to align with type stripping (byebye decorators)
    * Manifest writing is now the domain of the compiler
    * No longer pass in a delta to the compiler, the compiler will produce its own delta    
    * Moved most of the compiler code under the src folder
    * Aggressively avoid loading typescript until needed.  Allows the compiler main invocation to be fast
* Module is no longer a special word, can use it as a variable freely
* Shutdown overhaul
   * Signal is now the driving item for registering and initiating the shutdown process
   * Removed a lot of legacy logic/weirdness
   * Reworked cli's watch/repeat cycle
   * Standards ftw
   * Reworked exit handling for restartable processes
* Removed TRV_ENV and Runtime.env in lieu of profiles and role
   * TRV_ENV was a weird artifact and is no longer necessary
   * TRV_ROLE provides 99% of the needed data for runtime selection
   * TRV_PROFILES provides the other 1% for configuration selection
* ESLINT cleanup
   * Using the new entrypoint hooks, eslintconfig.js became much smaller
   * Reviewed rules, added new ones about imports
* Mongo
   * Fixed bug in config being applied to url and passed as connection options
* S3
   * Fixed bugs in configuration, handling empty values properly
