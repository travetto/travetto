The common environment variables throughout the code base:

## General App
* `TRV_ENV` = dev|prod|any        - Environment to deploy, defaults to `NODE_ENV` if not `TRV_ENV` is not specified.
* `TRV_PROFILES`= ['application'] - Additional profiles to run app under
* `TRV_RESOURCES` = ['resources'] - The folders to use for resource lookup
* `TRV_WATCH` = 0|1               - Whether or not to run the program in watch mode
* `TRV_READONLY` = 0|1            - Should compilation be supported, forced to false in PROD.  Defaults to 1
* `TRV_CACHE` = cwd               - The output directory for compilation, defaults to `.trv_cache` of the cwd
* `TRV_SHUTDOWN_WAIT` = 2s        - The max time to wait for shutdown to finish after initial SIGINT, default `2s`

## Logging 
* `TRV_DEBUG` = 0|*               - Outputs all console.debug messages, defaults to `*` in dev, and `off` in prod.  Will inherit from `DEBUG` if not specified.
* `TRV_COLOR` = 0|1               - Suppress color output in all usages, defaults to `true` if tty is available.  Will respect `FORCE_COLOR` and `NO_COLOR` if passed in, secondary to the `TRV_COLOR` setting, if specified.
* `TRV_LOG_PLAIN` = 0|1           - Determines whether or not to augment console log information, default is `0`
* `TRV_LOG_TIME` = 0|ms|s         - Determines if we should log time when logging, defaults to `ms` 
* `TRV_LOG_FORMAT` = json|text    - Determines desired log format

## Tests
* `TRV_TEST_COMPILE` = 0|1        - Determines if all tests should be compiled, primarily used for tool integration, defaults to `0`
* `TRV_TEST_PHASE_TIMEOUT` = 15s  - The default time to wait for each phase to finish, default `15s`
* `TRV_TEST_TIMEOUT` = 5s         - The default time for a single test to finish, default `5s`

## Command
* `TRV_DOCKER` = 0|ns             - Docker support, if non-zero, acts as the docker namespace.  If `0`, disables running if docker should even be considered when running a command service, defaults to `undefined`

## Framework
* `TRV_DEV` = `./module`          - The folder for local travetto modules
* `TRV_DEV_ROOT` = `./`           - The source folder for local travetto checkout
* `TRV_MODULES` = []              - The list of additional npm modules to treat as framework modules
* `TRV_SRC_COMMON` = ['src']      - The common folders to search across all modules in, for source files.  Auto loaded at runtime.
* `TRV_SRC_LOCAL` = []            - The folder local only to the application that is searched for source files.  Useful for loading in optional sub-applications.
* `TRV_DOC_BRANCH` = `master`     - The branch to target the documentation against.
* `TRV_NODE_MAJOR` = DEFAULT      - The node major version to compile for, translates into a specific typescript target for compability. Will default to the version of node used for compilation.
* `TRV_CONSOLE_WIDTH`             - An override for controlliing output-width for cli-based operations.