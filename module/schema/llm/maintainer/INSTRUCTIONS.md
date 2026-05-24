# Schema LLM Instructions

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Edit Strategy

- Prefer additive behavior over changing decorator semantics.
- Keep validation messages stable and developer-friendly.
- Ensure metadata and runtime behavior stay aligned.

## Decorator Work

1. Add decorator logic in src/decorator/.
2. Wire metadata consistently with existing schema registration paths.
3. Add tests for both metadata registration and runtime validation behavior.

## Binding and Validation Work

- Keep coercion rules explicit and predictable.
- Avoid surprising implicit conversions.
- Validate nested schemas and arrays with clear path-aware errors.

## Compatibility Expectations

- Do not break existing @Schema/@Field usage patterns.
- Preserve discriminator and polymorphism behavior when touching type metadata.

## Validation Expectations

- Include positive and negative validation cases.
- Add regression coverage for any fixed edge case.
