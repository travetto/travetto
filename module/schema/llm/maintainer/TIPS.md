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

## Debugging Checks

- Inspect registered schema metadata before debugging validator code.
- Reproduce with minimal schema class and payload.
- Verify both raw input and post-bind instance state.
