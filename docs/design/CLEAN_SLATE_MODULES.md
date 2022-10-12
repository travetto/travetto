# Clean Slate Design for Module System

## Phase 1
Framework will now be broken into two parts:
* Compiler
  - The goal is to wrap `tsc` as much as possible, and remove as much custom logic where possible.
  - Transform (will still read transformers from module folders)
    - Will need to pre-compile support.transformer.* code
  - Compiler 
    - Will write out to .trv_cache/<full path>
    - Will generally just wrap tsc with minimal overhead
    - Remove concept of watching for changes
       - Dynamic code will need to move into run-time
         - Proxying
         - Load/Unload on file changes
  - Watch Mode
    - Will need to watch source files
    - There can only be one watcher for each .trv_cache
       * This is a problem we have today

* Run-time
  - All the other modules
  - Boot
    - No longer responsible for transpilation
    - Existing "source mods" will become a support.transformer.*
    - Will most likely still be responsible for module loading indexing
  - Includes Watch as well
    * Will watch .trv_cache/<full path> as the source for changes to care about


## Phase 2
Run-time behavior is rewritten
  - Resource 
   * loading
   * scanning
   * Multiple search paths
  - Module 
   * loading
   * scanning
   * Multiple search paths?























#### OLD
Primary goals:
* Decouple from `require` in preparation for ESM
* Decouple from `fs.*` operations to allow for bundling
* Have different implementations of filesystem operations (physical disk, memory, read from pre-indexed file)
   * Read file
   * Write file
   * List folder
   * Stat filelisten to changes in the output .js files
* 
* Resources will need a hybrid approach of multiple loaders
   * In-memory for bundles
   * Physical disk for runtime additions
* @travetto/boot will be the Wrapper/Host/Adapter to the underlying system
* Certain place will continue to allow usage of direct file system access, when appropriate (e.g. file uploading, and tests)
* Standard files need an index that can answer questions in real-time
   * Module index could be built as a projection of this standard file index
* No deletion support provided
   * TranspileCache may need to be rethought, as ESM doesn't support unloading either
   * Perhaps remove concept of "unloading"
* TranspileCache might need to act as a backfill to the Standard file index
   * Ask the same data source for all *.js files, but bridge between two folders
   * Would require constant node module resolution overlay
* Always import '.js' files, and let '.ts' be the 

## Radical Idea
* Bootstrap prepares a tsconfig.json that allows typescript to run everything, and write to .trv_cache*
* Compiler would go away
* Watch would only watch the output folder, not the source folder
* Dynamic Loader would be the event source to registry
* Would need to get typescript to write the correct folder structure for node_modules/*
* Cli/Build would just call out to tsc
   * Performance would most likely be impacted, may need to check for changed files before shelling out