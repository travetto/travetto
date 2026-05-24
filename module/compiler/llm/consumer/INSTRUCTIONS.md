# Compiler Instructions
How to work with the Travetto compilation process.

## Setup
1. The compiler is enabled by default in all Travetto apps.
2. Run npx trv build to pre-compile your application.

## Usage Workflow
- Use npx trv cli:schema to view the generated metadata for your project.
- Most users don't need to interact with the compiler API directly.

## Safe Defaults
- Let the framework handle compilation during development.
- Use TRV_BUILD=info or TRV_BUILD=warn in CI/CD pipelines for actionable logs.
