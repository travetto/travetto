# Model Query Instructions
How to use Travetto’s model query contracts safely.

## Setup
1. Define your model classes with @travetto/model.
2. Confirm your selected provider implements the specific query support interfaces you intend to call.
3. Treat query objects as typed application data, not string-built backend syntax.

## Usage Workflow
- Start with `ModelQuerySupport` for reads and counts.
- Add `ModelQueryCrudSupport` only when query-driven mutations are required.
- Use `select` to trim payload shape when full records are unnecessary.
- Use `sort`, `limit`, and `offset` for deterministic paging.
- Validate externally supplied clauses before execution when building reusable search endpoints.

## Safe Defaults
- Keep query shapes explicit and narrow.
- Prefer one well-defined query per use case over generic user-controlled pass-through.
- Separate index-driven lookups from broad query-driven search so the intent stays clear.