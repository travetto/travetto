travetto: Test
===

This module provides general integration with `ava`:

   - Will auto execute the `bootstrap` to provide typescript.
   - Auto-initialize of the application using the `test` environment. 
   - We provide user interface (`mocha` parlance for test suite interface) that extends from `bdd` 
     but allows for a few key niceties: 
       - The ability to globally define `beforeEach`, `afterEach`, `before`, and `after`. 
       - The ability to register methods that must be run before the testing can start.
   - Will look for `src/test/setup.ts` as a file to initialize the tests.
   - All tests will be looked for in `src/test/`