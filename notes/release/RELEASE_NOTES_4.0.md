# Travetto 4.0 Release Notes

> Release 4.0 - 2024-2-12

## Major/Breaking Changes
### NodeJS Alignment
* Shifted over to core nodejs logic where applicable, removed corresponding functionality

### Terminal
* No longer a core module
* Removed all terminal querying support
* Reduced available support to stream to line, at bottom and the table support

### Manifest
* Reworked structure
* Redefined how we built up the context
* Reworked how we navigate the modules for painting/role assignment
* Exposed:
   - RuntimeContext - The runtime manifest context.  This is the preferred usage for anyone that needs runtime manifest info
   - RuntimeIndex - The runtime manifest index.  This is necessary when interrogating the source at runtime
* Manifest Index is gone

### Compiler
* Reworked client support to be owned by compiler
* Added interface to cli to allow vscode to call command versus exposing complexity of client management.
* Reworked watching to use single watcher
   * Solved plenty of watch bugs
* Reworked server
   * Shutdown is now far more reliable
   * Reset/restart is now handled appropriately in all cases
   * Centralized ownership of sigint/sigkill signal to the core compiler process
   * Added in hard shutdown timeouts 
   * Added in PID tracking in case something hangs

### VSCode / Tooling Overhaul
* Reworked all integrations to push as much logic to the underlying tools
* All start/restart logic is removed and listens for the compiler state change as needed
* Source code is greatly simplified with less error states to care about in vscode (win)

### Base
* Externalized libraries that should have been elsewhere
   * DataUtil is now in Schema
   * Some Util functions are now in auth, for allow/deny matchers
* Broke apart NODE_ENV from TRV_ENV
   * TRV_ENV now defaults to package.travetto.build.defaultEnv
* Env overhaul
   * Now a typed interface for framework env
   * Compile time check
   * GlobalEnv is gone
* TimeUtil - removed unneeded logic
* StreamUtil - removed unneeded logic, defaulting to 'node:streams' in more cases
* ExecUtil - Complete rewrite
   * No longer takes responsibility for calling process.spawn
   * Expects a process to be provided, and will work with it after the fact
   * No longer defaulting options (env, stdio, cwd, etc), and is completely in the hands of the caller
* Shutdown was converted into graceful shutdown and is aimed at supporting the expected flow.  No longer interjecting into explicit kills and the complexity that brought.
* Startup minimizes the information needed to run, and streamlined console/debug relationship.  

### Pack
* Rewrote logic for dependency packing ensuring compatibility for ESM/CommonJS
