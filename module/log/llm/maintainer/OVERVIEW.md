# Logging Maintainer Overview
Maintainer guidance for formatter/appender compatibility and console interception behavior.

## Ownership
- Console interception and log event normalization pipeline.
- Formatter/appender contracts and default implementations.
- Runtime config integration for format/output behavior.

## High-Signal Entry Points
- src/service.ts
- src/config.ts
- src/formatter/
- src/appender/

## Integration Boundaries
- Consumed broadly by framework modules and application code paths.
- Downstream observability pipelines depend on stable output contracts.

## Compatibility Boundaries
- Formatter output shape and appender semantics are externally consumed and semver-sensitive.
- Console interception behavior affects global logging behavior across modules.

## Testing Expectations
- Validate line/json formatter behavior for representative event payloads.
- Validate appender behavior and failure handling paths.
- Recheck config-driven format/output switching across environments.

## Change-Triage Guidance
- Formatter changes: verify compatibility with log ingestion expectations.
- Appender changes: test backpressure/failure behavior and event loss boundaries.
- Interception changes: validate global logging consistency and opt-in/opt-out behavior.
