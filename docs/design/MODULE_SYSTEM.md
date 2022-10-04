# Module System (Separate from Transpilation)

## Primary Goals

1. Allow for module lookup at runtime, including an index built of all available/existing files in the application (and node_modules)
  a. Everything in node_modules/@travetto/* by default
  b. package.json can define additional metadata about dependencies to search?
  c. Allow for relative paths to be used
     - Useful in monorepos
     - Useful in framework development

2. Packaging needs to use precompiled as output form.
  a. Prod === precompiled (cannot compile at runtime)
  b. precompiled !== prod (can precompile without being in prod mode)

3. File Operations
  a. Source file, regardless of location
    - Search: configured folders, scans
    - Resolve to Target: with respect to module system
    - Generate module id
  b. Target file, node_modules/ file written out
    - Search: node_modules, needs to map into source files
    - Resolve to Source: convert node_modules/* path into source file
    - Resolve to hypothetical source: convert to realized typescript file (toUnixSource)
    - Generate module id

4. Transpiler
  - Typescript needs the Target converted into hypothetical source to honor the root

## Module Scenarios

### Precompiled (prod=run)
1. Need to load via node_modules, as usual
2. Need to scan pre-compiled files

### Standard (dev=debug, test=test) 
1. Scan node_modules/@travetto for default imports
2. Transpile/compile on demand
3. Load/Unload modules on demand

### Monorepo (dev=debug, test=test)
1. Everything in STANDARD
2. Need to resolve code paths relative to monorepo root
3. Allow for mapping in local, peer modules as node_modules
