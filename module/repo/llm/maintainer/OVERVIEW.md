# Repo Maintainer Overview
Maintainer guidance for workspace traversal, release orchestration, and multi-module execution semantics.

## Ownership
- CLI command behavior for list/version/publish/exec workflows.
- Module graph/scoping interpretation for changed-mode operations.
- Concurrency and process orchestration for cross-module execution.

## High-Signal Entry Points
- src/cli.*
- src/service.ts
- support/

## Integration Boundaries
- Depends on workspace package manager semantics and registry workflows.
- Consumed operationally by release automation and maintainers.

## Compatibility Boundaries
- Changed-module detection and command scope semantics are externally visible contracts.
- Version/publish command behavior is semver-sensitive for release automation.

## Testing Expectations
- Validate list/graph output stability for representative workspaces.
- Validate version/publish dry-run behavior and changed-scope filtering.
- Recheck repo:exec concurrency and failure aggregation behavior.

## Change-Triage Guidance
- Scope/detection changes: test false-positive/false-negative module selection.
- Publish/version changes: validate dry-run, auth, and registry error handling.
- Exec changes: verify deterministic ordering and robust failure reporting.
