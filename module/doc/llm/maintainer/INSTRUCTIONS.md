# Doc Maintainer Instructions

## Change Strategy
- Preserve stable output semantics for existing doc sources.
- Keep renderer behavior deterministic.
- Prefer additive node capabilities over breaking syntax shifts.

## Implementation Notes
- Keep source/link resolution explicit and test-backed.
- Guard command execution blocks from non-deterministic output.
- Avoid hidden behavior differences between markdown and html targets.

## Validation
- Run doc module tests and representative generation scenarios.
- Diff generated outputs before/after renderer changes.
- Verify CLI behavior for common output combinations.

## Regression Checklist
- Output formatting remains stable.
- Node semantics remain compatible.
- CLI generation stays deterministic.
