# DI LLM Overview

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Purpose

The di module provides class-based dependency registration and injection for Travetto applications. It is a foundational runtime wiring mechanism used across modules.

## What This Module Owns

- Injectable registration metadata.
- Injection resolution lifecycle.
- Qualifier/target handling for multiple implementations.
- Factory-based injectable construction.

## High-Signal Entry Points

- src/decorator.ts
- src/registry/
- src/types.ts
- src/error.ts

## Integration Boundaries

- Depends on runtime metadata and class identity.
- Used by config, web, model, and most service-centric modules.
- Keep this module focused on wiring and lifecycle; avoid embedding business logic.

## Typical Use Cases

- Registering an implementation for an abstract/base target.
- Using qualifiers to select among multiple candidates.
- Exposing factory-produced dependencies with InjectableFactory.
