# Registry Maintainer Instructions

## Change Strategy
- Preserve deterministic startup and finalization behavior.
- Keep adapter/index contracts backward compatible where possible.
- Prefer additive registry features over semantic lifecycle shifts.

## Implementation Notes
- Keep registration and read paths clearly separated.
- Ensure index store updates are explicit and test-backed.
- Avoid hidden ordering dependencies across adapters.

## Validation
- Run module tests for registration lifecycle and lookup behavior.
- Validate repeated initialization flows for idempotency.
- Recheck at least one downstream module that consumes registry metadata.

## Regression Checklist
- Registration/finalization semantics remain stable.
- Index lookup behavior remains deterministic.
- Adapter/type compatibility remains intact.
