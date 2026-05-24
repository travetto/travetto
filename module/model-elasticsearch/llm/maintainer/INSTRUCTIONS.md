# Model Elasticsearch Maintainer Instructions

## Change Strategy
- Keep provider behavior aligned with shared model/query/indexed contracts.
- Treat id mapping, query translation, and index lifecycle as high-stability surfaces.
- Prefer additive config and feature changes.

## Implementation Notes
- Re-check `_id`/`id` conversion whenever update/read logic changes.
- Keep index manager behavior consistent with model metadata expectations.
- Ensure query validation and translation remain synchronized with model-query semantics.

## Validation
- Run module tests and targeted integration flows for search, facets, and indexed retrieval.
- Validate startup against configured hosts and shutdown cleanup behavior.