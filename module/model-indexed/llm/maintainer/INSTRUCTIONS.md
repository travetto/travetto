# Model Indexed Maintainer Instructions

## Change Strategy
- Keep registration helpers small and deterministic.
- Treat `ModelIndexedSupport` method signatures and key-body types as public contracts.
- Prefer additive capability changes over shape-changing rewrites.

## Implementation Notes
- Update shared computation logic before touching provider-specific workarounds.
- Preserve the distinction between single-item operations and batch/list operations.
- Keep warning helpers aligned with the actual set of supported index shapes.

## Validation
- Run the module support tests and at least one provider suite that consumes indexed support.
- Re-check unique, sorted, nested-field, and polymorphism scenarios after behavior changes.