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
