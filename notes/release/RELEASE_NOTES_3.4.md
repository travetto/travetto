# Travetto 3.4 Release Notes

> Release 3.4.0 - 2023-11-12 - Under the Hood

## Major/Breaking Changes

### Upgrade to Typescript 5.1 (finally)
* Removed stale dependency that was causing rollup to break

### Cli internal cleanup
* Cli now properly supports `--flag='--a,--b,etc..`
* Cleaned up CLI logic for processing fields

### Compiler Orchestration Overhaul
* Compiler is now `trvc`, and the cli is `trv`
* Compiler now runs a server, and interacts with the requests for compilation, relying on port allocation to ensure non-conflicting operations
* Reorganized compiler entry points to provide a more consistent experience

### File Watching Refactor
* No longer relying on file-system watching outside of the compiler
* Services can now listen to the compiler to be notified of file changes
* Some modules may directly interface with parcel/watcher if the need is greater than listening to the compiler.

### Manifest dependency graph cleanup
* Profiles were complicated, unclear and often times implicit.  Removed this as a core pattern of the framework
* Now we flag each module as prod or not
* Also track any scopes it may rely upon (removed tie-in with profiles)
* RootIndex now requires far more information when walking the file/dependency graph
   * No more magic based on runtime

### GlobalEnv
* Global env was overhauled, removing profiles, as a special pattern.
* Removed ability to add additional flags. Externalizing ownership.

### Config
* Configuration no longer tied to base
* Profiles are only used for finding files to load
* Entire loading process has been mad much clearer
* Priorities are also much clearer when loading from multiple sources

### Resource access
* Runtime resource loading is no longer a provider pattern, but explicitly aimed at only touching the file system
* Resource paths  now include the monorepo when appropriate
* Removed file system querying/searching functionality

### Schema 
* Shared generated types, and naming collisions
  * Now we tie synthetic types to function/method/class hierarchy and fallback to line number when necessary

### VSCode
* Reworked VSCode integration with all the new entrypoint behavior, and compiler changes
