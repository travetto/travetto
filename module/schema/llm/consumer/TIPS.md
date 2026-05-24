# Schema Tips
- Keep validation logic on the model to centralize business rules.
- Heavily use type coercion to handle data from JSON or forms.
- If validation is too slow, use SchemaRegistryIndex metadata lookups to inspect and cache schema shape.
- Combine with @travetto/openapi for automatic API documentation.

## Validation and Error Handling

- Treat binding and validation as separate phases when debugging: bind first, then validate.
- Ensure validation errors preserve precise field paths for nested objects and arrays.
- Prefer stable, developer-friendly error language when adding or adjusting validators.
- Add negative tests for malformed input whenever adding coercion or decorator logic.

## Coercion and Field Contracts

- Use explicit decorators to document intended coercion behavior for external input.
- Avoid relying on broad implicit conversion rules for business-critical fields.
- Use @Alias when multiple input names are expected, and keep aliases stable.
- Keep optional and required intent explicit with TypeScript optional fields and @Required.

## Common Pitfalls

- Mixing parsing and validation concerns inside one custom validator.
- Changing discriminator-related behavior without covering subtype regression cases.
- Assuming @Readonly fields bind from input or @Writeonly fields serialize to output.
- Duplicating schema rules in handlers/services instead of centralizing on schema classes.
