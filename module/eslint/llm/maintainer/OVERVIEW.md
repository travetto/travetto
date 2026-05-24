# Eslint Maintainer Overview
Maintainer guidance for framework lint integration, config registration, and custom plugin behavior.

## Ownership
- CLI lint registration and invocation flows.
- Framework-aware ESLint config generation behavior.
- Custom rule plugin contract and support-path loading behavior.

## High-Signal Entry Points
- src/cli.*
- src/config.*
- src/types.ts
- support/

## Integration Boundaries
- Consumed by project tooling, editors, and CI lint pipelines.
- Must remain compatible with framework module mode and workspace layouts.

## Compatibility Boundaries
- Generated config shape and command behavior are externally visible contracts.
- `TrvEslintPlugin` contract semantics are semver-sensitive for custom rule authors.

## Testing Expectations
- Validate `eslint:register` output across representative workspace modes.
- Validate lint command behavior and error propagation in CI-like runs.
- Recheck custom rule loading behavior from support paths.

## Change-Triage Guidance
- Config-generation changes: diff generated output for compatibility.
- CLI changes: verify command args/output behavior for tooling consumers.
- Plugin contract changes: validate existing custom rules compile/run unchanged.
