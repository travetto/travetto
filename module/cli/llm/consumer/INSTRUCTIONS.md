# CLI Instructions
Practical workflow for building and consuming Travetto CLI commands.

## Setup
1. Add a command class and annotate it with @CliCommand.
2. Define inputs with @CliFlag and related specialized flags.
3. Expose module/profile flags when command behavior is environment-sensitive.

## Usage Workflow
- Keep command inputs schema-friendly and explicit.
- Use @CliModuleFlag for monorepo-aware command targeting.
- Use @CliProfilesFlag for profile-specific execution.
- Use npx trv cli:schema to verify command contracts and input shape.

## Safe Defaults
- Keep command flags small and typed.
- Prefer explicit defaults in command code.
- Avoid hidden side effects in command constructors.
