# Clean Slate Design for Module System

## Compilation Flow
1. 
  Phase: manifest-bootstrap
  When: Corresponding `source://boot/**/*.js` are missing or out of date
  Steps:
    -
      Desc: Run tsc on `source://boot/{index,src/**,support/bin/**}.ts`
      Inputs:
        - `source://boot/{index,src/**,support/bin/**}.ts`
      Action: tsc
      Output: 
        - `source://boot/{index,src/**,support/bin/**}.js`

2.
  Phase: manifest-state-generate
  When: in development/build mode
  Steps:
    -
      Desc: Generates project manifest
      Input: 
        - `source://project`,
        - `source://modules`
      Action: `ManifestUtil::generate`
      Output: 
        - `memory://manifest`
    - 
      Desc: Generates manifest delta
      Input:
        - 'memory://manifest'
        - 'output://manifest'
      Action: `ManifestUtil::generateDelta`
      Output:
        - `memory://manifest-delta`    

3. 
  Phase: compiler-build
  When: `memory://manifest-delta` includes `source://**/support/transform*`, or `source://@travetto/transformer`
  Steps:
    - 
      Desc: Create compiler directory
      Input: 
        - `memory://manifest`
        - `source://@travetto/path/**/*`
        - `source://@travetto/transformer/**/*`,
        - `source://**/support/transform*`
      Action: tsc
      Output: 
        - `compiler://**`

4. 
  Phase: source-compile
  Steps:
    -
      When: `memory://manifest-delta` includes any changes
      Desc: Compile project sources
      Input: 
        - `compiler://manifest`
        - `source://project`,
        - `source://modules`
      Action: node `compiler://@travetto/transformer/support/main.compiler`
      Output: 
        - `output://manifest`
        - `output://**`
    - 
      When: `watchable://true` and changes in `source://project`
      Desc: Watch for changes
      Action: Run Step 1

5. 
  Phase: source-execute
  Steps:
    -
      Desc: Run compiled sources
      Input:
        - `output://manifest`
        - `output://**`
      Action: node
    - 
      When: `watchable://true` and changes in `output://**`
      Desc: Watch for changes
      Action: Specific logic for live-reload


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
   * TRV_DEV is gone
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
- Rework vscode plugin:
   * Fix how we invoke operations
- Rework pack:
   * Use manifest for staging files
   * Integrate with bundler (webpack, vite, etc?)
- Rework top-level command to start/stop all services
   * Cannot rely on module marfing
- DI factory behavior with interfaces
- Rewrite docs:
   * config
   * base
   * boot
- Tests
   * config
   * base 
   * boot   

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