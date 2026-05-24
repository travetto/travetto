# Model Redis Maintainer Instructions

## Change Strategy
- Keep Redis behavior aligned to model + model-indexed contracts.
- Treat key-resolution and index-maintenance logic as high-stability surfaces.
- Prefer additive config and capability updates.

## Implementation Notes
- Re-test `getByIndex`, `pageByIndex`, `listByIndex`, and `suggestByIndex` after index logic edits.
- Keep store mutation and index mutation coordinated in a single logical flow.
- Validate expiration behavior when touching write or read code paths.

## Validation
- Run module tests and targeted integration scenarios with keyed and sorted indexes.
- Verify startup/shutdown and namespaced storage cleanup behavior.