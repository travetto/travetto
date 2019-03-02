

The common environment variables throughout the code base:

* `INIT_CWD` = cwd          - The current running directory
* `TRV_FRAMEWORK_DEV` = 0|1 - If we are in development mode, 
* `TRV_CACHE_DIR` = cwd     - The output directory for compilation, PID is a special value that generates a new folder based on the process id
* `TRV_TEST_BASE`           - A variable that indicates the fully qualified path for the test module, used to bypass issues with symlinks
* `TRV_DI_BASE`             - A variable that indicates the fully qualified path for the di module, used to bypass issues with symlinks

* `APP_ROOTS` = ['.']       - The root of the application search space
* `RESOURCE_ROOTS` = ['.']  - The root of resource searching
* `ENV` = dev|prod          - Environment to deploy
* `PROFILE`=['application'] - Additional profiles to run app under

* `QUIET_INIT` = 0|1        - Display the init information on startup
* `NO_COLOR` = 0|1          - Suppress color output in all usages, defaults to true if tty is available
* `DEBUG` = 0|1             - Outputs all console.debug messages, defaults to 1 in dev, and 0 in prod
* `TRACE` = 0|1             - Outputs all console.trace messages, defaults to 0 in dev, and 0 in prod

* `WATCH` = 0|1             - Wether or not to run the program in watch mode
* `DEBUGGER` = 0|1          - Indicates whether or not a debugger is attached.  Some timing compensation is needed

* `TEST_FORMAT` = tap|json  - Defaults to tap
* `TEST_CONCURRENCY` = 4    - Defaults to 4 or 1 - cpu count
* `TEST_MODE` = single|all  - Single vs all