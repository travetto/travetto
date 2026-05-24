# Config Overview
The @travetto/config module provides a structured, type-safe way to manage application settings across different environments.

## What This Module Is
This module resolves configuration from files and sources, binds values into typed config classes, and validates those values through schema integration.

## Why To Use It
- It standardizes configuration loading across local/dev/prod environments.
- It keeps config typed and validated instead of loosely parsing process.env.
- It supports deterministic overrides and source precedence.

## When To Use It
- Use for any service requiring environment/profile-specific settings.
- Use when startup should fail fast on invalid configuration.
- Use when configuration must come from files plus environment overrides.

## When Not To Use It
- Do not scatter direct process.env access across business code.
- Do not hand-roll source merge behavior unless module-specific needs require it.

## Core Capabilities
- Recursive configuration loading from .yml and .json files.
- Environment-specific overrides (e.g. application.prod.yml).
- Typed configuration objects via decorators.
- Automatic binding of environment variables to config fields.

## Decorators (Consumer API)

### @Config(namespace)
- Marks a class as configuration-backed and bindable by the framework.
- The namespace controls which configuration section is bound.
- Config classes are injectable through DI after binding.

Example:

```ts
import { Config } from '@travetto/config';

@Config('database')
export class DatabaseConfig {
	host = 'localhost';
	port = 5432;
}
```

### @EnvVar(name, ...aliases)
- Declares environment variable overrides for a specific config field.
- Accepts a primary variable name and optional fallback aliases.
- Useful when migrating from legacy env names or supporting multiple deploy platforms.

Example:

```ts
import { Config, EnvVar } from '@travetto/config';

@Config('database')
export class DatabaseConfig {
	@EnvVar('DB_HOST', 'DATABASE_HOST')
	host = 'localhost';
}
```

## Utility Classes (Non-Internal)

- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- ConfigurationService for loading and resolving active configuration values.
- ConfigSource extension points for custom external configuration providers.

Decision guideline:
Use typed @Config classes and source precedence controls for all application/module settings instead of mixing ad hoc env parsing and direct file reads.

## Typical Integration Flow
1. Define typed classes with @Config namespaces.
2. Load defaults from resources/application.* files.
3. Override specific fields with @EnvVar and deployment env vars.
4. Inject config classes into services via DI.

## Practical Scenario
For multi-environment deployments, keep baseline values in application.yml, environment specifics in profile files, and sensitive overrides through @EnvVar-bound variables.

Common pitfalls:
- Scattering `process.env` access outside config classes and breaking precedence expectations.
- Introducing ambiguous source priorities for custom ConfigSource implementations.
- Treating config binding/coercion as optional and allowing invalid startup state.

