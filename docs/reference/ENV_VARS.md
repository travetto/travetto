The common environment variables throughout the code base:

## General App
* `TRV_ENV` = dev|prod|any        - Environment to deploy, defaults to `NODE_ENV` if not `TRV_ENV` is not specified.
* `TRV_PROFILES`= ['application'] - Additional profiles to run app under
* `TRV_RESOURCES` = ['resources'] - The folders to use for resource lookup
* `TRV_DYNAMIC` = 0|1             - Whether or not to run the program in dynamic mode, allowing for real-time updates
* `TRV_SHUTDOWN_WAIT` = 2s        - The max time to wait for shutdown to finish after initial SIGINT, default `2s`

## Logging 
* `DEBUG` = 0|*                   - Outputs all console.debug messages, defaults to `local` in dev, and `off` in prod. 
* `FORCE_COLOR` = 0|1             - Enables color, even if `tty` is not available, defaults to `false`.
* `NO_COLOR` = 0|1                - Disables color even if `tty` is available, defaults to `false`
* `TRV_LOG_PLAIN` = 0|1           - Determines whether or not to augment console log information, default is `0`
* `TRV_LOG_TIME` = 0|ms|s         - Determines if we should log time when logging, defaults to `ms` 
* `TRV_LOG_FORMAT` = json|text    - Determines desired log format

## Tests
* `TRV_TEST_PHASE_TIMEOUT` = 15s  - The default time to wait for each phase to finish.
* `TRV_TEST_TIMEOUT` = 5s         - The default time for a single test to finish.
* `TRV_TEST_DELAY` = 0s           - An additional wait for triggering test runs, useful for code that takes time to warm up

## Cli
* `TRV_CLI_JSON_IPC`              - Provides an IPC file location for the CLI to write supported commands to.  This facilitates cli-based invocation for external usage.

## Command
* `TRV_DOCKER` = 0|ns             - Docker support, if non-zero, acts as the docker namespace.  If `0`, disables running if docker should even be considered when running a command service, defaults to `undefined`

## Framework
* `TRV_CONSOLE_WIDTH`             - An override for controlling output-width for cli-based operations.

## Build
* `TRV_OUTPUT` = string           - The output directory for compilation, defaults to `.trv_output` of the cwd
* `TRV_COMPILER` = string         - The output directory of the compiler, defaults to `.trv_compiler` of the cwd