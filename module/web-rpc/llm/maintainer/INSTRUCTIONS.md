# Web Rpc Maintainer Instructions

## Change Strategy
- Preserve generated client API compatibility for existing consumers.
- Keep generator/runtime separation explicit.
- Prefer additive generation features over output format rewrites.

## Implementation Notes
- Keep generation templates deterministic and test-backed.
- Ensure proxy runtime errors remain typed and actionable.
- Avoid hidden assumptions about output path or target environment.

## Validation
- Run module tests for generation and runtime invocation paths.
- Diff generated output before/after changes for compatibility.
- Validate one representative client target mode in integration.

## Regression Checklist
- Generated API shape remains stable.
- Proxy runtime behavior remains predictable.
- CLI/config generation behavior remains deterministic.
