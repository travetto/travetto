

The common environment variables throughout the code base:

## General App
* `ENV` = dev|prod|any      - Environment to deploy
* `PROFILE`=['application'] - Additional profiles to run app under
* `APP_ROOTS` = ['.']       - The root of the application search space
* `RESOURCE_ROOTS` = ['.']  - The root of resource searching
* `WATCH` = 0|1             - Wether or not to run the program in watch mode

## Logging 
* `PLAIN_CONSOLE` = 0|1     - Determines whether or not to augment console log information, default is 0
* `NO_COLOR` = 0|1          - Suppress color output in all usages, defaults to false if tty is available
* `FORCE_COLOR` = 0|1       - Require color output in all usages, defaults to true if tty is available
* `DEBUG` = 0|1             - Outputs all console.debug messages, defaults to 1 in dev, and 0 in prod
* `TRACE` = 0|1             - Outputs all console.trace messages, defaults to 0 in dev, and 0 in prod
* `LOG_TIME` = 0|ms|s       - Determines if we should log time when logging, defaults to `ms`

## Tests
* `DEBUGGER` = 0|1          - Indicates whether or not a debugger is attached.  Some timing compensation is needed
* `IDLE_TIMEOUT` = 120000   - Default timeout for a test-worker, determines self termination if no request within that time window

## Exec
* `NO_DOCKER` = 0|1         - Indicates if docker should even be considered when running a command service, defaults to 0
* `DOCKER_NS` =             - Defaults to undefined, but can be specified to ensure unique instantation

## Framework
* `TRV_DEV` = 0|1           - If we are in development mode, 
* `TRV_CACHE` = cwd         - The output directory for compilation, defaults to `.trv_cache` of the cwd