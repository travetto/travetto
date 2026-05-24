# Pack Maintainer Overview
Maintainer guidance for packaging command behavior, bundling integration, and artifact compatibility.

## Ownership
- CLI pack command semantics (`pack`, `pack:zip`, `pack:docker`).
- Rollup integration and bundling orchestration.
- Artifact generation steps (manifest/resources/entry scripts/dockerfile).

## High-Signal Entry Points
- src/cli.*
- support/rollup/
- support/pack.*

## Integration Boundaries
- Integrates with compiler/manifest/runtime expectations.
- Consumed by deployment automation and CI/CD scripts.

## Compatibility Boundaries
- CLI option behavior and output structure are externally visible.
- Bundle/runtime compatibility is semver-sensitive.

## Testing Expectations
- Validate each command target output (dir/zip/docker).
- Validate entrypoint and manifest generation correctness.
- Validate docker build artifacts with representative configs.

## Change-Triage Guidance
- CLI changes: check automation compatibility.
- Bundler changes: regression-test runtime startup and module loading.
- Artifact changes: diff output structure and generated scripts.
