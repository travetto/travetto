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

## Safe Defaults
- Keep namespace values explicit per environment.
- Treat indexed support as contract-driven and validate index definitions at startup.
- Avoid endpoint patterns that rely on unbounded scans.