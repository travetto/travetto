# Config Overview
The @travetto/config module provides a structured, type-safe way to manage application settings across different environments.

## Primary Capabilities
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

## When to use it
Use this whenever your application needs external configuration or environment-specific settings.
