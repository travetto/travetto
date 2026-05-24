# Schema Tips
- Keep validation logic on the model to centralize business rules.
- Heavily use type coercion to handle data from JSON or forms.
- If validation is too slow, use SchemaRegistryIndex metadata lookups to inspect and cache schema shape.
- Combine with @travetto/openapi for automatic API documentation.
