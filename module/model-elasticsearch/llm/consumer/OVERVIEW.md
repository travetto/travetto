# Model Elasticsearch Overview
The @travetto/model-elasticsearch module provides an Elasticsearch-backed implementation of Travetto model contracts.

## What This Module Is
This module exports a configurable `ElasticsearchModelService` and `ElasticsearchModelConfig` that support model CRUD, query, indexed, bulk, facet, suggest, and expiry behaviors against Elasticsearch indices.

## Why To Use It
- It aligns Elasticsearch operations with the shared Travetto model/query interfaces.
- It provides broad query and search-oriented capabilities in one provider.
- It supports development-time index/schema management through the provider lifecycle.

## When To Use It
- Use it when Elasticsearch is the primary datastore for model-backed entities.
- Use it when you need query, facet, and suggestion capabilities backed by Elasticsearch.
- Use it when indexed access and flexible search should coexist in one provider.

## When Not To Use It
- Do not use it if your project needs strict relational integrity semantics.
- Do not assume Elasticsearch-specific behavior is portable to SQL or Mongo providers.
- Do not skip explicit model/query constraints in APIs just because search is flexible.

## Core Capabilities
- `ElasticsearchModelService` implements CRUD, bulk, expiry, indexed, query, facet, and suggest contracts.
- `ElasticsearchModelConfig` supports host/port/options, namespace, schema config, and culling cadence.
- Storage/model lifecycle methods for schema/index management.
- Search scrolling and index-backed paging support for larger result sets.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exports no standalone utility classes; the primary public API is `ElasticsearchModelService` and `ElasticsearchModelConfig`.

## Core APIs and Extension Points
- `ElasticsearchModelConfig` is bound at `model.elasticsearch` and controls provider behavior.
- `ElasticsearchModelService` is the main runtime provider surface for model operations.
- Service replacement/override can be done through DI factory registration.

## Typical Integration Flow
1. Configure `model.elasticsearch` hosts, namespace, and connection options.
2. Resolve `ElasticsearchModelService` through DI as the active provider.
3. Use model/query/indexed contracts from application code.
4. Rely on provider storage/model lifecycle hooks for index management in development workflows.

## Practical Scenario
A catalog service uses Elasticsearch for product data with both deterministic lookups and broad text filtering. The application uses indexed methods for exact SKU retrieval, query methods for faceted search, and suggest methods for type-ahead. The same business-layer contracts stay stable while relying on Elasticsearch-specific execution underneath.