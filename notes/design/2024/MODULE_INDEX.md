# Module Indexing (v2)

## Package Sources
A given module has the following

Production Dependencies:
  - module://package.json/#dependencies

Development Dependencies:
  - module://package.json/#devDependencies
  - mono-repo://package.json/#workspace modules (at monorepo root)
  - mono-repo://package.json/#travetto.withMainModules

Details
- Prod?: Will this module go to production
- Main?: Should this module be treated as main (index non `std` files, useful for testing/docs/etc.)
- Workspace?: Is this module a part of the local workspace or an external dependency
- Role Root?: Should this package be treated as a root for role propagation
- Roles?: List of roles a package should be rooted with
    * compiler      - `trvc build` -- Resources needed to run the compiler
    * doc           - `trv doc`    -- Resources tied to the doc module, and generating documentation
    * test          - `trv test:*` -- Test resources
    * build         - `trv email:*, trv pack` -- External tools used for building/packaging
    * std/undefined - Standard source will go to prod

## Detail Scenario (In order of priority)
- Root module (module where request to manifest starts at)
  - Prod?: true
  - Main?: true
  - Workspace?: true
  - Role Root?: true
  - Roles?: `['std']`
- Monorepo workspace module (and Root is monorepo root):
  - Prod?: false
  - Main?: true
  - Workspace?: true
  - Role Root?: true
  - Roles?: `['std']`
- WithMainModule: // Treated as a dependency
  - Prod?: false
  - Main?: if flag is `main`
  - Workspace?: true // Ensure its viewed as in the workspace, even if its external
  - Role Root?: false
  - Roles?: `[]` // To be filled in
- Dependency/DevDependency
  - Prod?: has Dependency path to root
  - Main?: false
  - Workspace?: If in workspace
  - Role Root?: false
  - Roles?: if child of `roleRoot` then `pkg.travetto.roles ?? ['std']` else `SUM of all parent roles`

## Dependency Traversal
Within the code base, we have a series of the above packages that need to be understood when we are generating the manifest.

The manifest will record all the above information within the scope of a single root (e.g. monorepo, or sub module, or standalone)

The flow of information for traversal is top-down, so traversal needs to be `BFS` as each layer needs to be processed first before moving to the next to ensure `prod` and `role` information is propagated appropriately.

The traversal logic has the following goals:
  * Appropriately visit all dependencies to include in the manifest for compilation
  * Ensure only the required dependencies are tagged as production
     - Prod is determined by all packages that have a package.json `dependencies` path from the root.  
     - `devDependencies` do not go to prod
     - `dependencies` of `devDependencies` do not go to prod
     - A dependency is defined as `prod` if it is already `prod` or it's parent is `prod` and the dependency is  in the parent's `pkg.dependencies`
  * Ensure roles are assigned appropriately to guarantee that we have the minimal set of files in the `std` group
     - If the dependency is a `roleRoot`, then ignore any provided role information it may have `package.travetto.roles`
        * Initialize to empty set for `role`
     - For each child of `roleRoot` packages, 
        * Initialize to their respective `package.travetto.roles`, or `['std']` if undefined
     - Propagate `role` information from parent to child while visiting
     - When done, for each `roleRoot`
        * Set role to `['std']` as the root is intended to be included in the output