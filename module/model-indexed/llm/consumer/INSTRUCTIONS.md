# Model Indexed Instructions
How to use computed indexes safely and predictably.

## Setup
1. Start with a persisted model from @travetto/model.
2. Define indexes close to the model class so the access pattern stays visible.
3. Confirm the chosen model provider implements `ModelIndexedSupport` before relying on index methods.

## Usage Workflow
- Use `keyedIndex` for exact lookups on one or more fields.
- Use `uniqueIndex` only when duplicate writes must fail consistently.
- Use `sortedIndex` when you need ordered paging, listing, or prefix-driven suggestions.
- Pass every required key field, and for single-item sorted lookups also pass the sort field when the index shape requires it.
- Use `ModelIndexedUtil.naiveUpsert` or `naiveUpdate` only as a compatibility fallback when the provider lacks a native optimized path.

Minimal pattern:
1. Export index definitions from one module next to the model type.
2. Reuse those exported constants at every call site.
3. Keep indexed read/write operations in a thin repository layer so key-shape changes are localized.

## Safe Defaults
- Keep index keys stable and based on persisted fields.
- Prefer a small number of intentional indexes over broad speculative coverage.
- Treat index definitions as part of your model contract and keep names stable.
- Use sorted indexes only when callers actually depend on deterministic order.