# Compiler LLM Instructions

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Edit Strategy

- Preserve build determinism and incremental correctness.
- Keep state transitions explicit and observable.
- Avoid introducing race-prone async flows.

## Build Pipeline Work

1. Identify affected compilation phase(s) before editing.
2. Keep invalidation logic narrowly scoped to changed inputs.
3. Preserve separation between manifest prep, transformer prep, and TS invocation.

## Watch and Server Work

- Keep server lifecycle idempotent across start/stop/restart commands.
- Ensure event streams reflect true compiler state progression.
- Maintain lock/synchronization behavior to avoid duplicate build processes.

## Validation Expectations

- Validate full build and watch mode for changed code paths.
- Verify no regression in single-run `build` workflows.
- Confirm event/state output remains coherent for CLI consumers.
