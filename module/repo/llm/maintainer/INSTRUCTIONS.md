# Repo Maintainer Instructions

## Change Strategy
- Preserve operational safety for versioning and publishing workflows.
- Keep module scoping deterministic and auditable.
- Prefer additive command options over semantic rewrites.

## Implementation Notes
- Keep changed-module detection explicit and test-backed.
- Ensure dry-run behavior mirrors real publish/version logic as closely as possible.
- Maintain predictable concurrency semantics for repo:exec.

## Validation
- Run module tests for command parsing and workflow execution paths.
- Validate representative release flows with dry-run first.
- Recheck monorepo edge cases (partial changes, dependency chains, command failures).

## Regression Checklist
- Scope and graph detection remain stable.
- Version/publish behavior remains safe and deterministic.
- Multi-module command execution handles partial failures predictably.
