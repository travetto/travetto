

The common environment variables throughout the code base:

* `TRV_DEV` = 0|1 - If we are in development mode, 
* `TRV_CACHE` = cwd     - The output directory for compilation, defaults to `.trv_cache` of the cwd

* `APP_ROOTS` = ['.']       - The root of the application search space
* `RESOURCE_ROOTS` = ['.']  - The root of resource searching
* `ENV` = dev|prod|any      - Environment to deploy
* `PROFILE`=['application'] - Additional profiles to run app under

* `PLAIN_CONSOLE` = 0|1     - Determines whether or not to augment console log information, default is 0
* `QUIET_INIT` = 0|1        - Display the init information on startup
* `NO_COLOR` = 0|1          - Suppress color output in all usages, defaults to false if tty is available
* `FORCE_COLOR` = 0|1       - Require color output in all usages, defaults to true if tty is available
* `DEBUG` = 0|1             - Outputs all console.debug messages, defaults to 1 in dev, and 0 in prod
* `TRACE` = 0|1             - Outputs all console.trace messages, defaults to 0 in dev, and 0 in prod
* `LOG_TIME` = 0|1          - Determines if we should log time when logging, defaults to 1

* `WATCH` = 0|1             - Wether or not to run the program in watch mode
* `DEBUGGER` = 0|1          - Indicates whether or not a debugger is attached.  Some timing compensation is needed

* `TEST_FORMAT` = tap|json  - Defaults to tap
* `TEST_CONCURRENCY` = 4    - Defaults to 4 or 1 - cpu count
* `TEST_MODE` = single|all  - Single vs all

* `JS_YAML` = 0|1           - Defaults to none, forces use of js-yaml over @travetto/yaml
* `NO_JS_YAML` = 0|1        - Defaults to none, forces use of @travetto/yaml over js-yaml

* `IDLE_TIMEOUT` = 120000   - Default timeout for a test-worker, determines self termination if no request within that time window
* `EXECUTION_REUSABLE`= 0|1 - Determines if a test-worker can be reused, within the `IDLE_TIMEOUT` window.  Primarily used for integration with external test runners.