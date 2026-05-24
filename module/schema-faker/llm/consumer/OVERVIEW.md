# Schema Faker Overview
The @travetto/schema-faker module generates synthetic data for schema-registered types.

## What This Module Is
This module maps schema metadata, field names, and types into faker-backed value generation routines.

## Why To Use It
- It accelerates test and fixture generation.
- It produces realistic sample data aligned with schema structure.
- It reduces manual mock object maintenance.

## When To Use It
- Use when generating seeded or random data for tests/dev workflows.
- Use when schema shape should drive fixture generation automatically.
- Use when nested sub-schemas need coherent fake data.

## When Not To Use It
- Do not use for production data synthesis where deterministic domain rules are strict.
- Do not assume generated values satisfy all business invariants without additional constraints.

## Core Capabilities
- Type-driven generation for primitive/schema fields.
- Name/regex-based value refinement (email/url/name/etc.).
- Nested schema generation through schema registry awareness.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `SchemaFaker`: primary API for generating schema-shaped fake instances.

## Core APIs and Extension Points
- `SchemaFaker.generate` entrypoint.
- Name/type mapping strategies for field generation.
- Schema-driven nested object generation behavior.

Decision guideline:
Use SchemaFaker as the default fixture source for schema-modeled classes, then layer deterministic overrides for domain-critical fields.

## Typical Integration Flow
1. Define schema classes with `@Schema`.
2. Call `SchemaFaker.generate(YourType)`.
3. Override sensitive or scenario-specific fields.
4. Use generated instance in tests or preview flows.

## Practical Scenario
For integration tests, generate user/profile/address records from schema classes, then override IDs and timestamps to deterministic values before persistence.

Common pitfalls:
- Relying on random output for snapshot-sensitive tests.
- Forgetting to override fields with strict uniqueness/business constraints.
- Assuming every field-name mapping matches domain intent.
