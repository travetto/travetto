# Travetto 0.6 Release Notes

> Release 0.6.x: 2019-04-15 -- BETA -- 7bf8998ed07dcf257981ffa73aa1b9630f8ff6b1

* Test assertions and output cleanup
  * Cleanup tests output on run
* Using latest typescript
* Reworked CLI, convert to typescript, supporting color, and standardizing architecture
* Added in tab completion support for cli
* Auth Rewrite
* Worker breakout/rewrite
* Rest module rewrite, interceptors overhauled
   * Allow for direct binding of query/path/form params to function parameters
* General test stability
* Support for unhandled rejections in the testing framework
* Base logging upgrade, and ability to filter logging by package, folder etc.
* Reworked config/compiler, handling unloading properly now
* Session support at the framework level
* Reworked yeoman generator to use mustache and add auth support
* Separated boot (typescript to javascript compile) from base, base is now used by simple modules
