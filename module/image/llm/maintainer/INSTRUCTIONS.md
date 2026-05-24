# Image Maintainer Instructions

## Change Strategy
- Preserve conversion option semantics for existing call sites.
- Keep stream-based processing deterministic and safe.
- Prefer additive options over changing default behavior.

## Implementation Notes
- Keep sharp-related conversion logic isolated and test-backed.
- Avoid hidden quality/format defaults that alter existing outputs.
- Maintain explicit error pathways for unsupported/invalid inputs.

## Validation
- Run module tests for common conversion profiles.
- Validate mixed-format and edge-dimension input behavior.
- Recheck one downstream consumer pipeline.

## Regression Checklist
- Conversion outputs remain compatible.
- Stream handling remains stable.
- Error behavior remains predictable and typed.
