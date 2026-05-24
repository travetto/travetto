# Manifest Overview
The @travetto/manifest module tracks the structure and contents of your project and its dependencies.

## Primary Capabilities
- Module and file discovery within a workspace.
- Dependency graph resolution.
- Resource finding and path resolution.
- Build-state tracking for the compiler.

## Decorators

- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)

- ManifestUtil: create/read/write manifest files and update manifest state.
- ManifestModuleUtil: module scan, file typing, role detection, and output-extension helpers.
- ManifestFileUtil: buffered file write and JSON file read helpers.
- ManifestDeltaUtil: compute source/output deltas for incremental compilation.
- PackageUtil: package and workspace dependency discovery utilities.

## Other Core Consumer API

- ManifestIndex: in-memory indexed access to modules/files and find/filter operations.

## Agent Tooling Surface

- Use npx trv cli:schema to discover command surfaces that depend on manifest/module indexing.

## When to use it
Use it when you need to programmatically locate files, resources, or other modules in your application.
