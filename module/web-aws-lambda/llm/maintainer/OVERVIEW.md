# Web Aws Lambda Maintainer Overview
Maintainer guidance for Lambda adapter behavior, packaging defaults, and deployment compatibility.

## Ownership
- Lambda event-to-web request adapter semantics.
- Default entrypoint integration for pack workflows.
- Response translation and Lambda runtime boundary behavior.

## High-Signal Entry Points
- src/
- support/entry.handler.ts
- package command integration points in related pack modules

## Integration Boundaries
- Depends on @travetto/web execution pipeline.
- Integrates with packaging/build tooling for Lambda artifacts.

## Compatibility Boundaries
- Event/request mapping behavior is externally visible.
- Packaging entrypoint and adapter contracts are semver-sensitive.

## Testing Expectations
- Validate representative API Gateway event translation.
- Validate response/status/header mapping under common scenarios.
- Validate packaging entry integration for deployable output.

## Change-Triage Guidance
- Adapter changes: regression-test request/response mapping.
- Entrypoint changes: verify packaging and runtime startup.
- Runtime changes: test error and edge-case propagation.
