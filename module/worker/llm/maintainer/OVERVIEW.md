# Worker Maintainer Overview
Maintainer guidance for worker lifecycle control, IPC abstractions, and pool scheduling behavior.

## Ownership
- Worker process startup/shutdown and supervision logic.
- `WorkPool` scheduling/concurrency behavior.
- `IpcChannel` transport and event semantics.

## High-Signal Entry Points
- src/pool.ts
- src/ipc.ts
- src/

## Integration Boundaries
- Integrates with Node child process and IPC primitives.
- Consumed by modules needing isolated/background execution.

## Compatibility Boundaries
- IPC message semantics and pool APIs are externally visible.
- Lifecycle behavior changes can affect reliability contracts.

## Testing Expectations
- Validate pool concurrency and queue/backpressure behavior.
- Validate IPC messaging under normal and failure paths.
- Validate worker startup, crash recovery, and shutdown handling.

## Change-Triage Guidance
- Pool logic changes: regression-test throughput and starvation behavior.
- IPC changes: verify compatibility and serialization assumptions.
- Lifecycle changes: stress test process failure/restart handling.
