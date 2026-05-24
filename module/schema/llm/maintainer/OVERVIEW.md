# Schema LLM Overview

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Purpose

The schema module provides runtime type metadata, binding, and validation. It is a core dependency for config, web, cli, model, and other modules that rely on typed input/output contracts.

## What This Module Owns

- Schema and field registration metadata.
- Decorator-driven constraints and annotations.
- Binding raw payloads into typed instances.
- Validation pipeline and error reporting.

## High-Signal Entry Points

- src/decorator/
- src/service/
- src/validate/
- src/bind-util.ts
- src/type-config.ts
- src/types.ts

## Integration Boundaries

- Shared core abstraction; changes affect many modules.
- Keep module neutral and avoid endpoint/storage-specific behavior.
- Preserve compatibility with existing decorators and metadata conventions.

## Dependency Sensitivity

- Schema is a foundational contract layer for config, web, cli, model, and related tooling.
- Changes to binding, coercion, or validation semantics can cascade across modules.
- Treat registry metadata shape and error-path behavior as long-lived contracts.

## Stability Priorities

1. Preserve deterministic registration and lookup behavior.
2. Preserve discriminator/subtype compatibility unless a migration path is provided.
3. Keep validation failures precise, stable, and developer-actionable.
4. Keep module-level behavior transport/storage neutral.

## Typical Use Cases

- Add or refine field decorators.
- Improve validation or binding behavior for edge cases.
- Extend type metadata representation for downstream tooling.
