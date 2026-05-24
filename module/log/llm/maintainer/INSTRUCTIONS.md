# Logging Maintainer Instructions

## Change Strategy
- Preserve stable event structure and formatter/appender contracts.
- Keep interception behavior explicit and deterministic.
- Prefer additive logging metadata and config features.

## Implementation Notes
- Keep formatter output deterministic for same input event.
- Ensure appender failures are handled without crashing unrelated flows.
- Validate config fallback behavior when format/output env vars are absent.

## Validation
- Run module tests for formatter/appender/config behavior.
- Validate representative logs in line and JSON modes.
- Recheck downstream ingestion compatibility for compatibility-sensitive changes.

## Regression Checklist
- Event structure remains backward compatible.
- Formatter/appender behavior remains deterministic and robust.
- Environment-driven format/output behavior remains predictable.
