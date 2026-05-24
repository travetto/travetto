# Schema Overview
The @travetto/schema module provides powerful data validation and transformation for TypeScript classes.

## What This Module Is
This module is the framework's type metadata, binding, and validation backbone for structured input/output contracts.

## Why To Use It
- It keeps data contracts explicit and enforceable at runtime.
- It centralizes validation and coercion rules near model definitions.
- It powers consistent behavior across config, web, model, and cli modules.

## When To Use It
- Use for API payload validation and parameter binding.
- Use for config and model classes requiring strict data shape guarantees.
- Use when decorators should drive validation and schema metadata generation.

## When Not To Use It
- Do not rely only on ad hoc runtime checks scattered through service code.
- Do not duplicate schema rules in multiple modules when one schema class can define them.

## Core Capabilities
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

## Core APIs and Extension Points
- SchemaValidator for runtime validation entry points.
- SchemaRegistryIndex for metadata lookup and registry operations.
- BindUtil/DataUtil/SchemaTypeUtil for coercion and type transformation flows.

Decision guideline:
Use schema decorators and binding/validation utilities as the single source of truth for external input contracts, instead of duplicating checks across handlers and services.

Runtime metadata guidance:
- Use SchemaRegistryIndex when you need runtime schema introspection for framework-level tooling.
- Prefer decorator-driven schema definitions for application logic instead of manual metadata mutation.
- Keep dynamic metadata reads side-effect free so validation and binding behavior remains deterministic.

## Typical Integration Flow
1. Define schema classes and field decorators.
2. Bind raw input with BindUtil or framework integrations.
3. Validate with SchemaValidator.
4. Reuse the same schemas across web/config/model surfaces.
5. Add regression tests when introducing new decorators or coercion behavior.

## Practical Scenario
When a request payload and a persisted model share structure, define a schema once and enforce correctness in both web request handling and storage lifecycle paths.

Common pitfalls:
- Relying on broad implicit coercion for business-critical fields without explicit constraints.
- Changing discriminator or alias behavior without regression checks across integration surfaces.
- Mixing custom parsing logic into validators and losing path-aware error consistency.

