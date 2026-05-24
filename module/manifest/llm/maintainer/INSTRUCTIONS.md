# Manifest LLM Instructions

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Edit Strategy

- Keep manifest output stable and deterministic.
- Preserve compatibility for downstream compiler/runtime consumers.
- Treat path normalization changes as high-risk.

## Indexing and Classification Work

1. Locate file/module classification logic in src/file.ts and src/module.ts.
2. Keep classification rules explicit and test-backed.
3. Ensure metadata fields are populated consistently for all modules.

## Delta and Dependency Work

- Minimize false positives/negatives in src/delta.ts logic.
- Preserve grouping/ordering assumptions consumed by compiler flows.
- Keep dependency interpretation consistent across monorepo and single-project contexts.

## Validation Expectations

- Verify manifest generation output for representative modules.
- Verify delta behavior for add/change/delete scenarios.
- Validate path behavior on normalized POSIX-style expectations.
