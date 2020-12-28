The common environment variables throughout the code base:

## General App
* `TRV_ENV` = dev|prod|any       - Environment to deploy, listens to `NODE_ENV` if not `TRV_ENV` is not specified.
* `TRV_PROFILES`=['application'] - Additional profiles to run app under
* `TRV_ROOTS` = ['.']            - The root of the application search space
* `TRV_RESOURCE_ROOTS` = ['.']   - The root of resource searching
* `TRV_WATCH` = 0|1              - Wether or not to run the program in watch mode
* `TRV_READONLY` = 0|1           - Should compilation be supported, forced to false in PROD.  Defaults to 1
* `TRV_MODULES` = []             - The list of additional npm modules to treat as framework modules
* `TRV_REQUIRES` = []            - List of additional scripts to require before executing the primary registration

## Logging 
* `TRV_DEBUG` = 0|*              - Outputs all console.debug messages, defaults to `*` in dev, and `off` in prod.  Will inherit from `DEBUG` if not specified.
* `TRV_COLOR` = 0|1              - Suppress color output in all usages, defaults to `true` if tty is available.  Will respect `FORCE_COLOR` and `NO_COLOR` if passed in, secondary to the `TRV_COLOR` setting, if specified.
* `TRV_LOG_PLAIN` = 0|1          - Determines whether or not to augment console log information, default is `0`
* `TRV_LOG_TIME` = 0|ms|s        - Determines if we should log time when logging, defaults to `ms` 

## Tests
* `TRV_TEST_COMPILE` = 0|1       - Determines if all tests should be compiled, primarily used for tool integration, defaults to `0`
* `TRV_TEST_PHASE_TIMEOUT` = 15s - The default time to wait for each phase to finish, default `15s`
* `TRV_TEST_TIMEOUT` = 5s        - The default time for a single test to finish, default `5s`

## Command
* `TRV_DOCKER` = 0|any           - Docker support, if non-zero, acts as the docker namespace.  If `0`, disables running if docker should even be considered when running a command service, defaults to `undefined`

## Framework
* `TRV_DEV_ROOT` = `module/`     - The root folder for all modules, when in dev mode
* `TRV_CACHE` = cwd              - The output directory for compilation, defaults to `.trv_cache` of the cwd
* `TRV_SHUTDOWN_WAIT` = 2s       - The max time to wait for shutdown to finish after initial SIGINT, default `2s`

Anything not prefixed with `TRV_`, is a standard env var that we are leveraging