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

## Safe Defaults
- Use optional TypeScript fields (`?`) for non-required values.
- Prefer explicit numeric/string/email decorators for externally sourced data.
- Keep class-level rules in @Validator and field-level rules on decorators.
