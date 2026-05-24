# CLI Maintainer Overview
Maintainer guidance for @travetto/cli internals.

## Ownership
- Command registration and metadata model.
- Flag parsing and schema integration behavior.
- CLI execution lifecycle and process restart helpers.

## High-Signal Entry Points
- src/registry/decorator.ts
- src/registry/ (command registration/index)
- src/util.ts
- src/service.ts

## Integration Boundaries
- Strong coupling to schema for command input contracts.
- Tooling consumption via npx trv cli:schema output.

## Compatibility Boundaries
- Command/flag metadata shape and cli:schema output are externally consumed and semver-sensitive.
- Registry resolution and command-discovery behavior must remain stable across module boundaries.

## Testing Expectations
- Validate command discovery across representative modules.
- Validate flag parsing and schema generation for typed and specialized flags.
- Recheck restart-on-change and IPC debug paths when lifecycle code changes.

## Change-Triage Guidance
- Decorator/registry changes: test command indexing and backward compatibility for existing commands.
- Parsing/flag changes: validate default handling, alias behavior, and error output consistency.
- cli:schema changes: verify downstream tooling expectations and schema stability.
