# Clean Slate Design for Module System

## Compilation Flow
1. 
  Phase: compiler-bootstrap
  Desc: Run tsc on `source://transformer/support/bin/*.ts`
  When: `source://transformer/support/bin/*.ts` changes or is missing a `.js` counterpart
  Inputs:
    - `source://@travetto/transformer/support/bin/**/*.ts`
  Action: tsc
  Output: 
    - `source://@travetto/transformer/support/bin/**/*.js`

2.
  Phase: manifest-generate
  Desc: Generates project manifest
  When: in development/build mode
  Input: 
    - `source://project`,
    - `source://modules`
  Action: node `@travetto/transformer/support/bin/manifest`
  Output: 
    - `memory://manifest`

3.
  Phase: manifest-delta
  Desc: Generates project delta for any changed files
  When: `memory://manifest`
  Input: 
    - `memory://manifest`
    - `compiler://manifest`
  Action: node `source://@travetto/transformer/support/bin/manifest-delta`
  Output: 
    - `memory://manifest-delta`    

4. 
  Phase: compiler-stage
  Desc: Stage code for compiler-build
  When: `memory://manifest-delta` includes `source://**/support/transform*`, or `source://@travetto/transformer`
  Input: 
    - `memory://manifest`
    - `source://@travetto/transformer/**/*`,
    - `source://**/support/transform*`
  Action: copy or symlink
  Output: 
    - `staging://**` 

5. 
  Phase: compiler-build
  Desc: Run tsc on staged code
  When: `memory://manifest-delta` includes `source://**/support/transform*`, or `source://@travetto/transformer`
  Input: 
    - `staging://manifest`
    - `staging://**` 
  Action: tsc
  Output: 
    - `compiler://manifest`
    - `compiler://**`

6. 
  Phase: source-compile
  Desc: Compile project sources
  When: `memory://manifest-delta` includes any changes
  Watchable: 
    - `source://project`
  Input: 
    - `compiler://manifest`
    - `source://project`,
    - `source://modules`
  Action: node `compiler://@travetto/transformer/support/main.compiler`
  Output: 
    - `output://manifest`
    - `output://**`

7. 
  Phase: source-execute
  Desc: Run compiled sources
  Watchable: 
    - `output://**`
  Input:
    - `output://manifest`
    - `output://**`
  Action: node

## Details
Will provide a new multiphase compiler that:
* Step 1 - Generates a project manifest
   - Finds all transpilable modules
      - `@travetto/*`
      - Modules that have `"travettoModule: true"` in their `package.json`
   - Contains all the files for modules
      - Non node_module modules are treated as watchable source
      - Supported paths
        * `bin/`
        * `doc/`
        * `resources/`
        * `src/` 
        * `support/`
        * `test/`
          * `test/resources/`
        * `doc.ts`
        * `index.ts`
        * `package.json`
* Step 2 - Bootstrap compiler
  - Pull in `@travetto/transformer` code
  - Find all transformers from all loaded modules
  - Prepare a workspace (e.g. `.trv_compiler_staging`)
  - Symlink/copy necessary files
  - Prepare a valid tsconfig.json for this workspace
  - Run tsc, and output to `TRV_COMPILER=.trv_compiler`
     * Will produce all necessary .js files
     * Will copy over package.json files (and replace `"index.ts"` with `"index.js"`)

* Step 3 - Run compiler
  - This can be executed via `node .trv_compiler`
  - Modify the `cli/bin/trv.js` to:
     * Invoke compiler on changed files (writes to `TRV_CACHE=.trv_out`)
     * Execute from within the `TRV_CACHE`

## Architectural Changes
* `framework dev`
   * TRV_DEV is gone (well, its there, but now a boolean flag)
   * TRV_DEV_ROOT is gone
   * dev-register.js is gone   
* `@travetto/compiler` is no more
* `@travetto/transformer` is now independent of the rest of the framework (the new bootstrap)
* `@travetto/boot` 
   - is now independent of transpilation, and depends on `@travetto/transformer`
   - Relies on the manifest produced in `Step 1`, which removes need for scanning at startup (and works better for module packing)
   - Transpile cache is no longer used/needed
   - AppCache/FileCache are gone
* `@travetto/registry`, in watch mode, will now watch `TRV_CACHE` for changes, independent of the transpilation process
* `@travetto/test`, test-support has been removed
* `bin/*` No longer depends on `@travetto/boot`


## Pending Items
- get trv.js working properly with new compiler output
   - Only run compiler on file changes
- Modify `trv` to compile before running, and then run
- `trv-test` needs to be moved into `@travetto/test`
- fixup tests
- Rework pack to use manifest

## Deprecated

### Phase 1
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


### Phase 2
Run-time behavior is rewritten
  - Resource 
   * loading
   * scanning
   * Multiple search paths
  - Module 
   * loading
   * scanning






















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