# Async Context Instructions
How to use async context safely and predictably.

## Setup
1. Define typed AsyncContextValue handles for each scoped datum.
2. Mark entry methods with @WithAsyncContext where context should be active.
3. Inject/use AsyncContext where cross-async propagation is needed.

## Usage Workflow
- Initialize context once at operation boundaries.
- Read/write values through typed AsyncContextValue wrappers.
- Keep context keys small, stable, and purpose-specific.

Minimal pattern:
1. Activate context with @WithAsyncContext at service boundary.
2. Set correlation/user/tenant values once.
3. Consume values in nested async calls without manual parameter threading.

## Safe Defaults
- Keep context payload minimal and serializable where possible.
- Fail fast on uninitialized context when strict behavior is desired.
- Avoid leaking context values beyond operation boundaries.
