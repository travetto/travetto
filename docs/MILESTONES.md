--------------------------------------------------
encore 0.0.x: 2016-08-03 - 

--------------------------------------------------
* Simplistic base
* Moved to bootstrap

--------------------------------------------------
0.0.x: 2017-08-30 - 25df25468ba18629ec332db3ce96436083306ec1 - Released 
--------------------------------------------------

* Compiler enhancements
  * Hot module reloading
* Added registration framework
  * Added Dependency Injection built on it
* Fleshed out Asset module
* Standardized module file layout
* Reworked Test framework, supported TAP
* Created the vscode test plugin
* Documentation phase 1
* Merged Lifecycle into base
    * Application lifecycle now dependent on which modules used
* Model Elasticsearch
* Configuration move to DI
* Established Exec module 
* Rewrote phase management to describe dependencies better

--------------------------------------------------
Released 0.0.x monorepo: 2018-07-08 - 18b8297833dbba487594d2c27720d80208694e98
--------------------------------------------------

* Moved to mono repo with lerna 
* Alpha launch

--------------------------------------------------
Released 0.1.x: 2018-07-13 - 94dac6de9ef017002d1e952f34ae5b99171bda21
--------------------------------------------------

* Established github settings
* Working with lerna/nodejs quirks
* Expanded HttpRequest lib
* Moved extensions into own folder
* Established e2e for non unit tests
* Allow for development to work with symlinked packages
  * publishing and development become much easier
* Swagger Integration 

--------------------------------------------------
Released 0.2.x:  2018-08-10 - 6fc18359974f88bfc6f0d6df21aaf746073bc636
--------------------------------------------------

* Reworking to abstract rest middleware out
   * Koa
   * Fastify
* Moving express to rest, and going generic
* Introduce passport support
* Establishing CLI support
* Separating out email templating from email
* Moving pool into exec
* Began work on AWS Lambda support for rest endpoints
 
--------------------------------------------------
Released 0.3.x: 2018-08-30 - fb6bd5439f7491a7b8446bd3717c3ba35d8dbd4a
--------------------------------------------------

* Reworked utils for development
* Redefined base to not rely on transpilation
* Dropped barrel imports
* Simplified library files
* Rewrote inky in html5 parse
* Yeoman generator
* JWT Library
* Custom YAML Library (performance
* Model query language
* Docs phase 2

--------------------------------------------------
Released 0.4.x: 2018-10-24 - 813fb4f842f149bcaa28c2e055e81fc86221eae1
--------------------------------------------------
  
* Docs enhanced
* General bug fixes
* FsUtil as a base
* Cyclical dependency detection
* Simplified 
* Allow for CLI to know about entry points, and to execute
* Simplified logging
* Enhanced elasticsearch schemas

--------------------------------------------------
Released  0.5.x: 2018-12-28 - a8c58104a586baa6203f38c9517fbb5a60ecec5c
--------------------------------------------------

* Full test cleans up after self
* Development DOCS updated
* Simple caching enhancements
  * Cache dir now computed differently
  * Tests use unique cache dir for test runner
* Streamlined dev vs watch usage
* Enhanced app entry point usage
   * Detect parameters
   * Reset app cache on change
   * Application decorator with transformer
* vscode Plugin migration
  * Support all the things
* Testing stability
* Schema modifications
  * All view changes
  * New view management
* Unified file path usage and resource loading

------------------------------------------------------
Release 0.6.x: ???
------------------------------------------------------
* Test assertions and output cleanup
  * Cleanup tests output on run
* Using latest typescript
* Reworked CLI, supporting color, and standardizing architecture
* Added in tab completion support for cli
* Auth Rewrite
* Worker breakout/rewrite
* Rest module rewrite, interceptors overhauled
* General test stability
* Support for unhandled rejections in the testing framework
* Base logging upgrade, and ability to filter logging by package, folder etc.
* Reworked config/compiler, handling unloading properly now