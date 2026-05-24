# Repo Instructions
How to run safe monorepo operational workflows.

## Setup
1. Ensure workspace package manager and registry configuration are valid.
2. Use repo:list to verify module graph and scope before bulk operations.
3. Confirm changed-module detection behavior matches your release policy.

## Usage Workflow
- Use `repo:list` to scope affected modules.
- Use `repo:version` for coordinated version updates.
- Use dry-run `repo:publish` before actual publish.
- Use `repo:exec` for controlled multi-module maintenance operations.

Minimal pattern:
1. Inspect scope with list/graph output.
2. Apply version or maintenance command to scoped modules.
3. Validate via dry run before irreversible publish operations.

## Safe Defaults
- Always review changed-module scope before version/publish.
- Prefer dry-run mode for registry-impacting workflows.
- Keep repo:exec commands idempotent and concurrency-safe.
