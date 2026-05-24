# Schema Instructions
How to implement and use schemas.

## Setup
1. Install @travetto/schema.
2. Define a class and annotate it with @Schema.

## Usage Workflow
- Add field and validation decorators for your input contract.
- Use BindUtil.bindSchema(MySchema, rawData) for binding and coercion.
- Use SchemaValidator.validate(MySchema, instance) to validate bound instances.
- Use Alias/Required/Enum/Match decorators to keep input contracts explicit.

Minimal pattern:
1. Define one schema class per external input contract.
2. Bind raw input once at the boundary.
3. Validate the bound instance before domain logic executes.

## Common Patterns

### Bind request or config input
- Define a schema class with explicit decorators on externally sourced fields.
- Bind raw payloads with BindUtil.bindSchema(MySchema, rawData).
- Validate bound instances with SchemaValidator.validate(MySchema, instance).

### Nested objects and arrays
- Prefer nested @Schema classes over ad hoc object literals for deep payloads.
- For array fields, validate both element constraints and overall shape.
- Keep nested validation errors path-aware to simplify debugging.

### Polymorphic payloads
- Use @Discriminated on base types and @SubType on concrete variants.
- Preserve stable discriminator names and treat discriminator changes as compatibility-sensitive.
- Add tests for valid subtype resolution and invalid discriminator values.

### Views and access behavior
- Use @View for named visibility profiles when output surfaces differ.
- Use @Writeonly for inbound-only fields and @Readonly for output-only fields.
- Use @Secret for sensitive values that should remain masking-aware in downstream integrations.

### Cross-field rules
- Put cross-field logic in @Validator and field-local rules on field decorators.
- Keep @Validator results deterministic and concise so call sites receive stable failures.

## Safe Defaults
- Use optional TypeScript fields (`?`) for non-required values.
- Prefer explicit numeric/string/email decorators for externally sourced data.
- Keep class-level rules in @Validator and field-level rules on decorators.
- Favor explicit @Alias mappings when input names may vary across clients.
- Treat coercion as a convenience, not a substitute for clear validation constraints.
- Keep discriminator names stable and versioned when evolution is required.
