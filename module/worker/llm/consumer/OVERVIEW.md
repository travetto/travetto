# Worker Overview
The @travetto/worker module provides process-worker orchestration primitives, pools, and IPC messaging utilities.

## What This Module Is
This module offers worker process management and communication building blocks for concurrent background execution.

## Why To Use It
- It simplifies spawning and coordinating worker processes.
- It provides structured IPC channel abstractions.
- It supports pooled concurrent execution patterns.

## When To Use It
- Use when workloads should run in separate processes.
- Use when jobs benefit from managed worker pools.
- Use when parent-child process messaging needs stronger structure.

## When Not To Use It
- Do not use when simple in-process async execution is sufficient.
- Do not over-partition tiny tasks where IPC overhead dominates.

## Core Capabilities
- Worker pool orchestration for concurrent jobs.
- IPC channel abstraction for message/event communication.
- Process lifecycle control patterns for child-worker coordination.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `WorkPool`: manage pooled worker execution.
- `IpcChannel`: structured child/parent IPC messaging.

## Core APIs and Extension Points
- Work pool sizing and job dispatch behavior.
- IPC event/message contracts.
- Worker process startup/shutdown and supervision integration points.

Decision guideline:
Use worker pools for CPU-bound or isolation-sensitive jobs, and keep IPC contracts explicit and versioned where long-lived worker communication is required.

## Typical Integration Flow
1. Define worker-executable task contract.
2. Configure and create `WorkPool`.
3. Dispatch jobs and collect results.
4. Use `IpcChannel` for control/events as needed.

## Practical Scenario
For document transformation jobs, enqueue tasks in a worker pool, process in child processes, and stream status updates via IPC events to the parent orchestrator.

Common pitfalls:
- Using too many workers for memory-constrained workloads.
- Sending large payloads over IPC when shared storage pointers are better.
- Ignoring shutdown/restart handling for worker failures.
