# Async Context Overview
The @travetto/context module provides async-aware state propagation so contextual data remains available across asynchronous call chains.

## What This Module Is
This module wraps Node async context primitives and gives framework-friendly APIs for storing and retrieving request-like context during async execution.

## Why To Use It
- You need request/user/tenant context to survive across async boundaries.
- You want safer context access patterns than manually passing state through deep call stacks.
- You need typed context access via reusable field handles.

## When To Use It
- Use in services that coordinate multi-step async workflows and need shared context.
- Use for correlation IDs, user identity, permission context, or operation-scoped metadata.
- Use when nested async operations must read/write the same context values.

## When Not To Use It
- Do not use as a global mutable state container for unrelated operations.
- Do not replace explicit method arguments when the value is truly local and short-lived.

## Core Capabilities
- Async context propagation across promise and callback flows.
- Decorator-driven method context activation.
- Typed context field wrappers via AsyncContextValue.
- Optional strictness/error behavior for uninitialized context usage.

## Decorators
- @WithAsyncContext: activates and preserves async context for the decorated method invocation chain.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- AsyncContext: get/set/run operations for shared async state.
- AsyncContextValue<T>: typed accessor abstraction for specific context keys.

## Typical Integration Flow
1. Inject AsyncContext into services that manage request-scoped operations.
2. Annotate entry methods with @WithAsyncContext.
3. Read/write context values through AsyncContextValue instances for type safety.
4. Consume context values in nested async calls without manually threading parameters.

## Practical Scenario
When handling a request that triggers multiple async service calls, store a correlation ID once and access it everywhere downstream for consistent tracing and diagnostics.
