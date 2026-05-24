# Auth Session Instructions
How to use session-backed auth state safely.

## Setup
1. Install @travetto/auth-session and a model provider with expiry support.
2. Wire `SessionService` and `SessionContext` through DI.
3. Ensure authenticated request flows call session load/persist boundaries.

## Usage Workflow
- Load session state before accessing `SessionData`.
- Mutate session values through context/service boundaries.
- Persist session state once at request completion.

Minimal pattern:
1. `service.load()` at request/interceptor entry.
2. Read/write `SessionContext`/`SessionData` in handlers/services.
3. `service.persist()` in a finally block.

## Safe Defaults
- Keep session payload small and purpose-specific.
- Keep expiry semantics explicit and tested.
- Keep session destroy/logout flows consistent across endpoints.
