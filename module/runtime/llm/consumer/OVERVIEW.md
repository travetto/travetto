# Runtime Overview
The @travetto/runtime module is the core utility foundation for Travetto applications.

## What This Module Is
This module provides shared runtime primitives used across the framework: process context, environment access, lifecycle control, and utility helpers.

## Why To Use It
- It gives stable, framework-aware abstractions for environment and path behavior.
- It centralizes shutdown behavior and process utility logic.
- It reduces duplicated low-level helpers in application and module code.

## When To Use It
- Use for environment-aware behavior and workspace/module path resolution.
- Use for graceful shutdown and lifecycle-aware process cleanup.
- Use when you need shared serialization, binary, execution, and timing helpers.

## When Not To Use It
- Do not reimplement equivalent low-level helpers unless you need special semantics.
- Do not bypass shutdown abstractions for routine service termination.

## Core Capabilities
- Runtime and workspace context via Runtime.
- Graceful shutdown orchestration via ShutdownManager.
- Typed environment access via Env.
- Cross-cutting utility classes used by nearly every module.

## Decorators

- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)

- Util: generic helpers such as uuid generation, timeout helpers, async iterable mapping, and stack-trace parsing.
- BinaryUtil: byte and buffer helpers for binary data handling.
- BinaryMetadataUtil: read/write support for binary metadata blocks.
- CodecUtil: encoding and decoding helpers for common data formats.
- ExecUtil: subprocess execution helpers with structured process control.
- JSONUtil: safe JSON cloning, parsing, and serialization helpers.
- TimeUtil: time parsing and duration conversion helpers.
- WatchUtil: file watch helpers for incremental workflows.

## Additional High-Value Runtime APIs

- Runtime: workspace/module path resolution, import resolution, resource path lookup.
- ShutdownManager: abort signal and graceful process shutdown lifecycle.
- FileLoader: file and module loading helper for controlled dynamic loading.

## Core APIs and Extension Points
- Runtime for module/workspace/resource resolution.
- Env and EnvProp for typed environment variable access.
- ShutdownManager for graceful application stop/restart flows.

Decision guideline:
Use runtime abstractions for environment, path resolution, and shutdown behavior whenever logic is shared across modules or runtimes, rather than composing raw process/path primitives per call site.

## Typical Integration Flow
1. Use Runtime and Env for environment- and workspace-aware logic shared by config, web, and CLI modules.
2. Register cleanup behavior through ShutdownManager for services launched by web workers or CLI commands.
3. Reuse runtime utility classes instead of ad hoc helper code.

## Practical Scenario
When implementing a long-running worker, use Env to read deployment flags, Runtime to resolve resources, and ShutdownManager to ensure jobs are safely drained on termination.

Common pitfalls:
- Mixing raw `process.env` access with Env/EnvProp conventions and introducing inconsistent defaults.
- Calling `process.exit` in routine control paths and bypassing graceful shutdown cleanup.
- Re-implementing path/resource resolution instead of relying on Runtime semantics.

