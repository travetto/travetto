# Model Redis Instructions
How to use the Redis-backed model provider effectively.

## Setup
1. Install @travetto/model-redis.
2. Configure `model.redis` client options and namespace.
3. Resolve `RedisModelService` via DI.

## Usage Workflow
- Use CRUD methods for base persistence operations.
- Define model-indexed descriptors for deterministic secondary access.
- Use sorted indexes for ordered scans and suggestions.
- Keep API-level paging limits explicit for scan-heavy endpoints.

Minimal pattern:
1. Centralize Redis config/service wiring in one startup boundary.
2. Keep indexed-descriptor definitions near model design and review.
3. Validate one integration flow that exercises create/update/delete plus indexed retrieval.

## Safe Defaults
- Keep namespace values explicit per environment.
- Treat indexed support as contract-driven and validate index definitions at startup.
- Avoid endpoint patterns that rely on unbounded scans.
- Keep scan-heavy operations behind explicit limits and operational monitoring.