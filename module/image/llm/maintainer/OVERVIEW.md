# Image Maintainer Overview
Maintainer guidance for conversion utility behavior and image-processing compatibility.

## Ownership
- Image utility conversion/resize logic.
- Option parsing and transformation profile behavior.
- Stream integration and error handling semantics.

## High-Signal Entry Points
- src/util.ts
- src/types.ts
- support/

## Integration Boundaries
- Consumed by email compiler and other asset-processing workflows.
- Depends on sharp-backed behavior for in-process conversion.

## Compatibility Boundaries
- Conversion option semantics and output expectations are semver-sensitive.
- Stream behavior and error propagation are externally visible contracts.

## Testing Expectations
- Validate conversion behavior for representative formats and sizes.
- Validate stream error handling and resource cleanup.
- Recheck compatibility for downstream compile/pipeline consumers.

## Change-Triage Guidance
- Option changes: verify existing transformation presets.
- Conversion changes: test dimensions/quality/format outputs.
- Stream changes: validate backpressure and failure behavior.
