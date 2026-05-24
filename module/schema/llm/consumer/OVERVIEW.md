# Schema Overview
The @travetto/schema module provides powerful data validation and transformation for TypeScript classes.

## Primary Capabilities
- Runtime validation of complex data structures.
- Automatic type coercion (e.g. string to number).
- Metadata-driven validation using decorators (e.g. @Min, @Match).
- Support for nested schemas and arrays.

## Decorators (Consumer API)

### Schema shape and lifecycle
- @Schema: mark a class as schema-enabled and registrable.
- @SubType: declare a subtype relationship for polymorphic schemas.
- @Discriminated: define a discriminated schema family.
- @View: define named field visibility groups.
- @Validator: attach class-level validation logic.

### Field metadata and access behavior
- @Field: customize field-level schema metadata.
- @Writeonly: allow input binding while excluding value from output serialization.
- @Readonly: expose field in output but prevent external binding.
- @Secret: mark sensitive values for masking-aware consumers.

### Validation input decorators
- @Input: provide additional input configuration.
- @Alias: allow alternate field names at bind time.
- @Required: require non-empty input for a field.
- @Enum: constrain values to a finite set.
- @Text and @LongText: indicate natural-language inputs.
- @Match: enforce regex-based validation.
- @MinLength and @MaxLength: bound string lengths.
- @Min and @Max: numeric/date bounds.
- @Email, @Telephone, @Url: format-specific validators.
- @Precision: enforce decimal precision.
- @Integer, @Float, @Long, @Currency: numeric intent validators.
- @Specifier: attach additional schema-specific field specifiers.
- @DiscriminatorField: define subtype discriminator source field.

### Method and non-field decorators
- @Method: mark methods for schema-aware method metadata.
- @MethodValidator: attach method-level argument/result validation.
- @Describe: provide descriptions/examples for generated metadata.
- @IsPrivate: mark schema elements as private metadata.
- @Ignore: omit fields or members from schema registration.

## Utility Classes (Non-Internal)

- BindUtil: schema binding and coercion helpers (bindSchema, bindSchemaToObject, coerceInput, coerceParameters).
- DataUtil: low-level coercion, merge, regex, and plain-object helpers used by binding workflows.
- SchemaTypeUtil: type-level schema resolution helpers.

## When to use it
Use it for API request validation, data persistence models, and any scenario requiring strict data integrity.
