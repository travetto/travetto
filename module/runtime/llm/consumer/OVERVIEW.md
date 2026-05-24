# Runtime Overview
The @travetto/runtime module is the core utility foundation for Travetto applications.

## Primary Capabilities
- Runtime and workspace context via Runtime.
- Graceful shutdown orchestration via ShutdownManager.
- Typed environment access via Env.
- Cross-cutting utility classes used by nearly every module.

## Decorators

- This module does not expose consumer decorators.

## Utility Classes (Consumer API)

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

## When to use it
Use runtime APIs whenever you need environment-aware behavior, robust process lifecycle handling, or shared utility primitives instead of ad hoc helpers.
