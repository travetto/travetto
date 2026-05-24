# Config LLM Tips

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Practical Tips

- Treat priority ordering as part of the public contract.
- Keep source identifiers and diagnostics readable for troubleshooting.
- Reuse schema decorators and validators instead of duplicating checks.

## Common Pitfalls

- Accidentally flipping source precedence.
- Mutating source payloads after merge in ways that leak state.
- Forgetting role/profile interactions when testing config resolution.

## Debugging Checks

- Inspect effective source order first when values look wrong.
- Verify env-var override wiring for expected keys.
- Confirm bind/validate errors include enough field context.
