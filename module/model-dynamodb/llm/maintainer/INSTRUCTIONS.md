# Model Dynamodb Maintainer Instructions

## Change Strategy
- Keep provider behavior aligned to model + model-indexed contracts.
- Treat table/GSI lifecycle and indexed write paths as high-risk surfaces.
- Prefer additive config and utility changes.

## Implementation Notes
- Re-test `upsertModel` and index-diff/update logic when utility or schema code changes.
- Keep indexed query construction synchronized with computed index naming.
- Validate expiry behavior when touching write and read code paths.

## Validation
- Run module tests plus integration flows covering table lifecycle and indexed retrieval.
- Verify local endpoint and namespaced table behavior after config changes.

Regression checklist:
- Table/GSI reconciliation remains idempotent and safe across repeated runs.
- Indexed attribute mutation remains synchronized with descriptor definitions.
- Expiry and not-found behavior remains stable across read/update/delete paths.