# Compiler Overview
The @travetto/compiler module is the engine that transforms Travetto source code and generates necessary metadata.

## What This Module Is
This module is the build and watch orchestration layer for framework-aware TypeScript compilation.

## Why To Use It
- It provides framework-specific compilation features beyond plain tsc.
- It handles manifest, transformer, and incremental rebuild workflows.
- It unifies build/watch behavior across modules in monorepo and single-project setups.

## When To Use It
- Use for standard project build/watch/start compilation flows.
- Use when diagnosing framework compile pipeline behavior.
- Use when incremental rebuild correctness matters for fast feedback.

## When Not To Use It
- Do not replace with raw tsc for framework build pipelines.
- Do not bypass compiler lifecycle when relying on metadata/transformer features.

## Core Capabilities
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

## Core APIs and Extension Points
- Compiler server/client state APIs.
- Event/state streams for tooling and diagnostic integration.

Decision guideline:
Use compiler-managed build/watch flows whenever you rely on Travetto metadata or transformer behavior, rather than substituting raw TypeScript pipelines.

## Typical Integration Flow
1. Run compiler in build or watch mode through framework commands.
2. Consume manifest data and transformer output during compile phases.
3. Observe state/events for progress and diagnostics.
4. Use utilities for package rewrite and deterministic output behavior.

## Practical Scenario
When local build times regress, inspect compiler state/event output to determine whether invalidation scope is too broad or a specific phase is dominating runtime.

Common pitfalls:
- Treating broad invalidation as acceptable and losing incremental build performance.
- Bypassing compiler lifecycle in workflows that depend on manifest/transformer outputs.
- Adding async transitions without explicit state/event ordering checks.

## Agent Tooling Surface

- Use npx trv cli:schema to discover available compiler-adjacent commands and their input schema.

