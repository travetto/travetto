# Model Firestore Maintainer Instructions

## Change Strategy
- Keep provider behavior aligned with model + model-indexed contracts.
- Treat config finalization and indexed query construction as high-stability surfaces.
- Prefer additive changes for config and capabilities.

## Implementation Notes
- Re-test `getByIndex`, `pageByIndex`, and `suggestByIndex` whenever index computation/query building changes.
- Keep emulator and credential-path behavior predictable and well-validated.
- Ensure warnings for unsupported index shapes remain accurate.

## Validation
- Run module tests plus representative emulator-backed integration flows.
- Verify CRUD/indexed behavior and config init paths after edits.

Regression checklist:
- Namespace and collection naming remains stable and deterministic.
- Indexed query translation remains compatible with existing descriptors.
- Config finalization preserves explicit values while applying safe defaults.