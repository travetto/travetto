# Web Rpc Maintainer Overview
Maintainer guidance for RPC client generation, proxy runtime behavior, and contract compatibility.

## Ownership
- RPC client generation command and config handling.
- Generated artifact structure and proxy factory behavior.
- Type-linking behavior between controller metadata and client output.

## High-Signal Entry Points
- src/cli.*
- src/generator.*
- src/client.*
- src/config.ts

## Integration Boundaries
- Depends on @travetto/web controller metadata and generated type outputs.
- Consumed by frontend/node clients relying on typed proxies.

## Compatibility Boundaries
- Generated client API shape and factory behavior are semver-sensitive.
- CLI/config generation semantics are externally visible tooling contracts.

## Testing Expectations
- Validate generation output for representative controller signatures.
- Validate runtime proxy invocation behavior and error propagation.
- Recheck config-driven generation paths and target modes.

## Change-Triage Guidance
- Generator changes: diff generated output compatibility.
- Runtime changes: test proxy request/response behavior and failures.
- CLI changes: validate command args and output paths for automation.
