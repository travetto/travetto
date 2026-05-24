# Compiler LLM Overview

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Purpose

The compiler module orchestrates Travetto compilation and watch behavior, integrating with manifest generation and transformer compilation to support incremental builds.

## What This Module Owns

- Compiler execution workflow and state transitions.
- Build/watch orchestration and eventing.
- Compiler-server coordination for process synchronization.
- CLI-facing compile operations via trvc.

## High-Signal Entry Points

- src/compiler.ts
- src/server/
- src/state.ts
- src/watch.ts
- src/queue.ts
- src/event.ts
- src/ts-proxy.ts

## Integration Boundaries

- Deeply coupled with manifest and transformer behavior.
- Sensitive to file classification and delta calculations.
- Changes should prioritize deterministic, resumable, incremental execution.

## Compatibility Boundaries

- Compiler state/event transitions are externally consumed by tooling and are semver-sensitive.
- Invalidation and delta semantics are contract-visible through build/watch behavior.

## Typical Use Cases

- Fixing incremental rebuild invalidation edge cases.
- Improving watch/restart behavior in monorepos.
- Extending compiler event visibility for tooling.

## Change-Triage Guidance

- Invalidation/delta changes: run full build plus watch-mode regression checks.
- Event/state changes: verify ordering and coherence for CLI/tool consumers.
- Server lifecycle changes: validate start/stop/restart idempotency and lock behavior.
