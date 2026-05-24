# Manifest LLM Tips

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Practical Tips

- Debug with concrete manifest snapshots before changing logic.
- Keep file type and folder classification logic centralized.
- Validate monorepo assumptions explicitly when changing context code.

## Common Pitfalls

- Breaking path normalization and causing OS-specific regressions.
- Introducing subtle ordering changes that affect incremental compilation.
- Forgetting to update dependent consumers when manifest shape changes.

## Debugging Checks

- Compare expected vs actual file buckets for a target module.
- Inspect delta output for changed file scenarios.
- Confirm dependency resolution behavior with nested workspaces.
