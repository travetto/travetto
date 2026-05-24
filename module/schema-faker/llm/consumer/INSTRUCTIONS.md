# Schema Faker Instructions
How to generate fake data from schema classes.

## Setup
1. Install @travetto/schema-faker.
2. Ensure target classes are schema-registered.
3. Import `SchemaFaker` in your test/seed code.

## Usage Workflow
- Generate instances with `SchemaFaker.generate(ClassType)`.
- Apply deterministic overrides where required.
- Reuse generated fixtures in test factories.

Minimal pattern:
1. Define schema.
2. Generate fake instance.
3. Patch domain-specific values.

## Safe Defaults
- Keep randomness controlled for reproducible tests.
- Validate required domain constraints after generation.
- Use helper factories around SchemaFaker for consistency.
