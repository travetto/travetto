# Model Elasticsearch Maintainer Overview
Maintainer guidance for Elasticsearch provider behavior, index management, and query integration.

## Ownership
- Elasticsearch model provider implementation and startup lifecycle.
- Config handling for hosts, namespace, schema defaults, and runtime options.
- Integration of model, indexed, query, facet, suggest, and expiry contracts.

## High-Signal Entry Points
- src/service.ts
- src/config.ts
- src/index-manager.ts
- src/internal/query.ts
- src/internal/schema.ts
- support/

## Integration Boundaries
- Depends on @travetto/model, @travetto/model-query, and @travetto/model-indexed contracts.
- Uses the Elasticsearch JS client and index mappings as runtime substrate.
- Integrates with DI/config/runtime modules for lifecycle and shutdown behavior.

## Invariants
- ID handling (`_id` versus model `id`) must remain consistent with `storeId` behavior.
- Query/indexed contract behavior must remain compatible with shared module expectations.
- Index lifecycle operations should preserve model-configured index semantics.
- Expiry-aware reads must not return logically expired records.

## Extension Points
- Service wiring can be customized by replacing or extending `ElasticsearchModelService` via DI.
- Config fields can be extended additively without breaking existing keys.
- Internal query/schema translation can evolve while preserving contract-visible outcomes.

## Testing Expectations
- Run module-level tests for CRUD/query/indexed/bulk/facet/suggest/expiry behavior.
- Re-verify index lifecycle operations after schema or mapping changes.
- Validate startup/shutdown behavior around client initialization and shutdown hooks.

## Risk Areas
- Mapping/field translation drift can break queries silently.
- `storeId` and serialization changes can break read/write compatibility.
- Query translation and scroll pagination changes can affect API-level behavior.