# Test Maintainer Instructions

## Change Strategy
- Keep decorator semantics and lifecycle ordering stable.
- Preserve result model shape for external tooling compatibility.

## Implementation Notes
- Treat timeout/should-throw semantics as core behavioral contracts.
- Keep suite/test registration deterministic.
- Maintain consistency between runtime behavior and reported statuses.

## Validation
- Validate suite hooks ordering and test status transitions.
- Verify output compatibility for configured reporters.
