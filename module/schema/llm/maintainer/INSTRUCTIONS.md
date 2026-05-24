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
- Treat validation output shape and path formatting as compatibility-sensitive.

## Breaking Change Assessment

Before landing behavior changes, classify impact explicitly:

1. Decorator semantics changed (@Schema/@Field/@Required/@Alias/etc.)
	- Usually breaking unless additive and fully backward compatible.
2. Binding/coercion behavior changed
	- High risk for config/web/cli/model consumers; require broad regression validation.
3. Validation output behavior changed (message style, error path shape)
	- Breaking for consumers that parse or assert error payloads.

Prefer additive evolution with deprecation periods over abrupt semantic shifts.

## Validation Expectations

- Include positive and negative validation cases.
- Add regression coverage for any fixed edge case.

## Regression Checklist

- Existing decorator semantics stay stable for common schema patterns.
- Bind/coerce behavior remains deterministic for aliased, optional, and polymorphic inputs.
- Validation output preserves stable, path-aware errors for nested structures.

## Testing Matrix Expectations

When touching registration, binding, or validation behavior, validate beyond local unit tests:

- Schema module tests for registration/binding/validation behavior.
- At least one integration surface that consumes schema heavily (config, web, cli, or model).
- Polymorphism/discriminator tests when subtype resolution is affected.
- Nested object/array error path checks when validation traversal changes.

## CI and PR Expectations

- Summarize impact in PRs as one of: metadata, bind/coerce, validate, or mixed.
- Call out compatibility risk and required downstream checks in PR description.
- Keep documentation synchronized when public guidance or expected behavior changes.
