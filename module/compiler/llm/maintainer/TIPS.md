# Compiler LLM Tips

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Practical Tips

- Start from state/event flow when diagnosing compiler issues.
- Treat manifest delta and invalidation decisions as critical correctness points.
- Prefer robust logging around boundaries instead of broad debug noise.

## Common Pitfalls

- Over-invalidating and causing unnecessary full recompiles.
- Under-invalidating and producing stale output.
- Relying on timing assumptions in watch mode.

## Debugging Checks

- Confirm manifest and delta inputs match expected changed files.
- Trace state transitions from init through compile-end.
- Check server process ownership when commands appear to conflict.
