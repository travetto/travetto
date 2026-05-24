# OpenAPI Maintainer Overview
Maintainer guidance for metadata-to-spec traversal, config integration, and output stability.

## Ownership
- OpenAPI document generation from web/schema metadata.
- Spec configuration handling and environment-aware output behavior.
- Traversal and normalization logic for paths, components, and schema references.

## High-Signal Entry Points
- src/service.ts
- src/visitor.ts
- src/config.ts
- src/types.ts
- support/

## Integration Boundaries
- Depends on @travetto/web and @travetto/schema metadata contracts.
- Output consumed by docs tooling, client generators, and partner integrations.
- Must keep generation deterministic for repeatable CI artifacts.

## Compatibility Boundaries
- Generated schema/path structure and operation metadata are externally consumed and semver-sensitive.
- Traversal of web/schema metadata must remain stable for existing endpoint contracts.

## Testing Expectations
- Validate representative endpoint/parameter/body schemas in generated output.
- Validate component naming/reference stability across runs.
- Recheck config-driven output differences (json/yaml, host/info settings).

## Change-Triage Guidance
- Traversal changes: verify path/operation/component compatibility with prior specs.
- Config/output changes: test environment-specific generation and artifact persistence behavior.
- Type-mapping changes: validate schema representation for common primitives and nested types.
