# Schema LLM Tips

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Practical Tips

- Start by identifying whether a behavior belongs to registration, binding, or validation.
- Follow existing decorator naming and option conventions.
- Keep error path information precise for nested objects.

## Common Pitfalls

- Mixing parsing/coercion with validation in one step.
- Changing default required/optional behavior unintentionally.
- Breaking schema metadata assumptions used by config/web/model.

## Triage Workflow

1. Classify the issue first:
	- Registration/metadata (decorators, schema indexing)
	- Binding/coercion (raw input conversion)
	- Validation (constraints and error reporting)
2. Decide compatibility risk:
	- Additive metadata changes are usually lower risk.
	- Behavioral changes in bind/coerce/validate are usually high risk.
3. Scope regression depth:
	- Unit-only for isolated metadata additions.
	- Unit + integration coverage for behavior changes.

## Release and Stability Checks

- Preserve stable discriminator and subtype resolution behavior.
- Keep validation error paths precise and predictable for nested payloads.
- Prefer deprecation windows when semantics need to evolve.
- Record migration notes when consumer-facing behavior changes.

## Debugging Checks

- Inspect registered schema metadata before debugging validator code.
- Reproduce with minimal schema class and payload.
- Verify both raw input and post-bind instance state.
