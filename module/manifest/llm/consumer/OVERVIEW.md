# Manifest Overview
The @travetto/manifest module tracks the structure and contents of your project and its dependencies.

## What This Module Is
This module is the framework metadata index for modules, files, and resources across the workspace and dependencies.

## Why To Use It
- It provides fast, normalized discovery for module-aware tooling.
- It avoids repeated filesystem scans in runtime/tooling flows.
- It supports compiler and CLI operations that need project graph awareness.

## When To Use It
- Use when you need to find modules/resources/files by framework-aware rules.
- Use when compiler or tooling logic needs dependency and path metadata.
- Use when incremental workflows require change/delta calculations.

## When Not To Use It
- Do not crawl directories manually for artifacts that manifest already tracks.
- Do not build duplicate project indices unless your module has unique constraints.

## Core Capabilities
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

## Core APIs and Extension Points

- ManifestIndex for in-memory lookups and filtering.
- Manifest utilities for persistence, scans, and delta updates.

## Typical Integration Flow
1. Load or build manifest state.
2. Query modules/files/resources through ManifestIndex.
3. Feed module/file metadata to compiler and CLI tooling workflows.
4. Use delta/file utilities during incremental build or tool steps.

## Practical Scenario
When implementing a module-aware code generation command, use manifest lookups to target only relevant source files and dependencies instead of scanning the entire repository.

## Agent Tooling Surface

- Use npx trv cli:schema to discover command surfaces that depend on manifest/module indexing.

