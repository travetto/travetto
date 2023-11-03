# Module Indexing

## Module Structure
A given module has the following dependencies

Production:
  - module://package.json/#dependencies

Development:
  - module://package.json/#devDependencies
  - module://package.json/#peerDependencies - Optional or Not
  - module://package.json/#optionalDependencies
  - mono-repo://package.json/#global-modules

Within Development:
  - Runtime - e.g. a tool available for generating content (@travetto/rest-client) or an enhance debugging logger, etc.
            - Will not be available via the packed output

  - Tool    - Used during other phases, should not be loading during runtime
            - Can be inferred from environment (e.g. doc/test)
            - Can be explicitly requested
            - Common tools:
              * compiler
              * doc
              * test
              * pack

A given module may declare its dev dependency type if desired in it's `package.json`

e.g.
```
{
  "travetto": {
    "roles": ["doc"]
  }
}
```

### Visiting
For each dependency
  Recurse into ## Module Structure, but carry a flag of development or prod


## General Algorithm

Get current module
  - Build Initial Dependency List
    - Get dependencies from package.json
    - Get devDependencies from package.json
    - [IF mono repo child] Get globalModules from mono repo package.json as devDependencies or dependencies pending 'dev'|'prod' flag
    - [IF mono repo root]  Get all local modules as devDependencies


With the initial set of dependencies:
  if dependency is travetto module:
    - 'travetto' in package.json
    - Is a local module
  then:
    Color each item as prod/dev accordingly
    Visit each child package:
      If the child has roles, color pkg with those roles
      Visit all of child's dependencies, using the current node's roles as defaults for coloring
      Repeat until bottom of the tree is found (no dependencies are packages).
  

Then in a given scenario, test/doc/pack/compile, it will be on the caller to request the appropriate module set, and filter by roles