# Web Http Maintainer Instructions

## Change Strategy
- Preserve adaptation semantics between Node and Web contracts.
- Keep config finalization deterministic and profile-safe.
- Prefer additive startup features over lifecycle rewrites.

## Implementation Notes
- Keep request/response translation explicit and test-backed.
- Avoid introducing production-unsafe TLS defaults.
- Ensure serve lifecycle remains observable and predictable.

## Validation
- Run module tests for startup and request/response flows.
- Validate TLS and HTTP version combinations in representative environments.
- Recheck integration with one web application module.

## Regression Checklist
- Request/response mapping remains compatible.
- Config finalize behavior remains stable.
- Serve lifecycle remains deterministic.
