

The common environment variables throughout the code base:

## General App
* `TRV_ENV` = dev|prod|any       - Environment to deploy, listens to `NODE_ENV` if not `TRV_ENV` is not specified.
* `TRV_PROFILES`=['application'] - Additional profiles to run app under
* `TRV_ROOTS` = ['.']            - The root of the application search space
* `TRV_RESOURCE_ROOTS` = ['.']   - The root of resource searching
* `TRV_WATCH` = 0|1              - Wether or not to run the program in watch mode

## Logging 
* `DEBUG` = 0|*                  - Outputs all console.debug messages, defaults to `*` in dev, and `off` in prod
* `TRV_LOG_COLOR` = 0|1          - Suppress color output in all usages, defaults to `true` if tty is available.  Will respect `FORCE_COLOR` and `NO_COLOR` if passed in, secondary to the `TRV_LOG_COLOR` setting, if specified.
* `TRV_LOG_PLAIN` = 0|1          - Determines whether or not to augment console log information, default is `0`
* `TRV_LOG_TIME` = 0|ms|s        - Determines if we should log time when logging, defaults to `ms` 

## Tests
* `TRV_TEST_DEBUGGER` = 0|1      - Indicates whether or not a debugger is attached.  Some timing compensation is needed
* `TRV_TEST_COMPILE` = 0|1       - Determines if all tests should be compiled, primarily used for tool integration, defaults to `0`
* `TRV_TEST_PHASE_TIMEOUT` = 15s - The default time to wait for each phase to finish, default `15s`
* `TRV_TEST_TIMEOUT` = 5s        - The default time for a single test to finish, default `5s`
* `TRV_TEST_IDLE_TIMEOUT` = 2m   - Default timeout for a test-worker, determines self termination if no request within that time window, default `2m`

## Exec
* `TRV_DOCKER_DISABLE` = 0|1     - Indicates if docker should even be considered when running a command service, defaults to `0`
* `TRV_DOCKER_NS` =              - Defaults to undefined, but can be specified to ensure unique instantiation

## Framework
* `TRV_DEV` = 0|1                - If we are in development mode, 
* `TRV_CACHE` = cwd              - The output directory for compilation, defaults to `.trv_cache` of the cwd
* `TRV_SHUTDOWN_WAIT` = 2s       - The max time to wait for shutdown to finish after initial SIGINT, default `2s`

Anything not prefixed with `TRV_`, is a standard env var that we are leveraging