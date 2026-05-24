# Runtime LLM Instructions

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Edit Strategy

- Prefer minimal, composable utility changes.
- Preserve backwards-compatible function signatures when possible.
- Keep behavior deterministic across local and production runtime modes.

## When Adding Functionality

1. Determine whether logic belongs in runtime or a higher-level module.
2. Add or extend strongly typed contracts in src/types.ts or nearby type files.
3. Keep API surface small and generic.
4. Ensure path handling remains POSIX-normalized where expected.

## Runtime/Environment Changes

- Update src/env.ts when introducing new environment flags.
- Keep defaults explicit and documented.
- Ensure behavior is stable when env vars are missing or malformed.

## Shutdown and Lifecycle

- Register cleanup through shutdown abstractions rather than ad hoc signal handlers.
- Keep shutdown callbacks idempotent and resilient to partial failures.

## Validation Expectations

- Run module tests that touch runtime behavior and any directly affected dependents.
- For broad utility changes, spot-check one downstream consumer module.

## Regression Checklist

- Env defaults and malformed-input handling remain deterministic.
- Runtime path/resource resolution remains stable across workspace layouts.
- Shutdown callbacks remain resilient and do not regress process-exit behavior.
