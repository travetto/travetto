# Model Indexed Overview
The @travetto/model-indexed module adds computed secondary-index support on top of the core model contracts.

## What This Module Is
This module defines typed index descriptors, indexed service contracts, and helper utilities for model providers that can resolve records by computed key and sort values.

## Why To Use It
- It gives you stable lookup patterns without requiring the full query DSL.
- It lets you define reusable secondary keys directly against model classes.
- It standardizes index-based fetch, upsert, paging, listing, and suggestion flows across providers.

## When To Use It
- Use it when you need lookup-by-field behavior such as email, slug, or composite business keys.
- Use it when your backend can support computed key or sorted index access more cheaply than arbitrary queries.
- Use it when you want a typed contract that multiple model backends can implement consistently.

## When Not To Use It
- Do not use it when you need rich filtering, boolean clauses, or arbitrary predicates; use @travetto/model-query instead.
- Do not model every access pattern as an index if the backend already has a native query engine you plan to expose.
- Do not assume non-index-aware providers will honor these contracts unless they explicitly implement ModelIndexedSupport.

## Core Capabilities
- Define keyed indexes with `keyedIndex` for deterministic secondary lookups.
- Define unique indexes with `uniqueIndex` for uniqueness enforcement on computed keys.
- Define sorted indexes with `sortedIndex` for ordered paging, listing, and suggestions.
- Use `ModelIndexedSupport` to fetch, mutate, iterate, and suggest by index.

## Decorators
This module exposes no decorators. Indexes are defined with factory functions that register metadata on model classes.

## Utility Classes (Non-Internal)
- `ModelIndexedUtil`: support detection plus fallback `naiveUpsert`, `naiveUpdate`, and suggestion-regex helpers.
- `ModelIndexedComputedIndex`: computes key and sort values from index templates and concrete data.

## Core APIs and Extension Points
- `keyedIndex`, `uniqueIndex`, and `sortedIndex` register index metadata on a model.
- `ModelIndexedSupport` defines `getByIndex`, `deleteByIndex`, `upsertByIndex`, `updateByIndex`, `updatePartialByIndex`, `pageByIndex`, `listByIndex`, and `suggestByIndex`.
- `warnIfIndexedUniqueIndex` and `warnIfNonIndexedIndex` help providers surface unsupported index shapes.

## Typical Integration Flow
1. Define a model with `@Model` from @travetto/model.
2. Register one or more computed indexes next to the model definition.
3. Use a backend such as @travetto/model-memory or another provider that implements `ModelIndexedSupport`.
4. Route reads and targeted writes through the index contract instead of manually scanning model data.

## Practical Scenario
For a user account system, define a unique index on `email` and a sorted index on `{ organizationId } + { createdAt: -1 }`. Use the unique index for sign-in or duplicate protection, and the sorted index to page through the newest users in a tenant. If you later swap providers, application code can keep calling the same indexed contract instead of rewriting lookup logic.