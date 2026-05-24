# Config LLM Instructions

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Edit Strategy

- Preserve source precedence and deterministic merge behavior.
- Keep parsing/binding flow explicit and testable.
- Prefer extending source abstractions over hardcoding source-specific logic.

## Working With Sources

1. Add source implementation under src/source/.
2. Define stable priority semantics and document conflict behavior.
3. Ensure payloads are normalized before bind/validation.

## Decorator and Binding Updates

- Keep @Config and @EnvVar metadata behavior backward compatible.
- Ensure schema validation errors are clear and actionable.
- Avoid introducing hidden side effects during class construction.

## Validation Expectations

- Cover default behavior, overrides, and precedence collisions.
- Test missing/invalid config behavior and error output.
- For parser changes, include representative yaml/json/properties cases.
