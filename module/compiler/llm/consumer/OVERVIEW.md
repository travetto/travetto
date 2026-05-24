# Compiler Overview
The @travetto/compiler module is the engine that transforms Travetto source code and generates necessary metadata.

## Primary Capabilities
- On-the-fly TypeScript transformation.
- Metadata generation for DI, Schema, and other modules.
- Fast incremental builds and hot reloading in development.
- Diagnostic tools for inspecting the compilation state.

## Decorators

- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)

- CompilerUtil: package.json rewrite and hashing helpers used during compile output generation.
- CommonUtil: shared compilation helper logic for command and process workflows.
- EventUtil: event-stream and event-shaping helpers for compiler lifecycle state.

## Agent Tooling Surface

- Use npx trv cli:schema to discover available compiler-adjacent commands and their input schema.

## When to use it
It runs automatically during development and build steps. Use it for performance optimization and custom transformations.
