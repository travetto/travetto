# Model SQL Maintainer Instructions

## Change Strategy
- Keep service-level behavior provider-agnostic and dialect-driven.
- Treat transaction semantics and connection scoping as contract-sensitive behavior.
- Prefer additive improvements that preserve existing dialect extension points.

## Implementation Notes
- Update decorators, connection base logic, and service call paths together when changing transaction behavior.
- Keep schema-visitation and SQL-rendering changes synchronized with table-manager expectations.
- Ensure query verification and SQL query generation continue to agree on accepted query shapes.

## Validation
- Run model-sql tests plus one concrete SQL backend suite.
- Recheck create/update/upsert/delete, query/list, and bulk/indexed operations after code changes.