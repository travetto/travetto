# DI LLM Tips

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Practical Tips

- Prefer constructor or field injection patterns already present in the module ecosystem.
- Use qualifiers only when multiple implementations are genuinely required.
- Keep dependency graph easy to reason about.

## Common Pitfalls

- Introducing ambiguous injectable candidates without qualifier strategy.
- Assuming interface-based injection in TypeScript runtime contexts.
- Creating circular dependencies accidentally through new services.

## Debugging Checks

- Inspect registry contents for target and qualifier mapping first.
- Reproduce with minimal injectable set when resolution fails.
- Check optional vs required injection semantics in failing paths.
