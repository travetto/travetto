# Manifest LLM Overview

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Purpose

The manifest module indexes project/module files and metadata, providing a normalized runtime/compile-time view of the workspace and enabling delta-based incremental compilation.

## What This Module Owns

- Manifest structure and serialization.
- Module/file indexing and classification.
- Manifest delta computation against outputs.
- Cross-platform path normalization behavior.

## High-Signal Entry Points

- src/manifest-index.ts
- src/module.ts
- src/file.ts
- src/delta.ts
- src/path.ts
- src/context.ts
- src/dependencies.ts

## Integration Boundaries

- Direct input for compiler incremental behavior.
- Runtime consumers use manifest data for discovery/loading.
- Path normalization must remain consistent across operating systems.

## Typical Use Cases

- Adjusting file type classification or manifest shape.
- Debugging unexpected rebuilds due to delta mismatches.
- Extending module metadata consumed by other framework modules.
