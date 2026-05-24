# Config Instructions
Best practices for setting up application configuration.

## Setup
1. Define your config structure as a class.
2. Annotate the class with @Config('prefix').
3. Create resources/application.yml in your project root.

## Decorator Usage Workflow
1. Add @Config('namespace') to each config class you want the framework to bind.
2. Add @EnvVar('NAME', 'ALIAS_NAME') to fields that need explicit env-var overrides.
3. Keep field defaults in class definitions so local development works without a full env setup.

Example:

```ts
import { Config, EnvVar } from '@travetto/config';

@Config('service')
export class ServiceConfig {
	@EnvVar('SERVICE_PORT')
	port = 3000;

	@EnvVar('SERVICE_TOKEN', 'LEGACY_SERVICE_TOKEN')
	token = '';
}
```

## Usage Workflow
- Inject your config class into your services using DI.
- Override values via environment variables: PREFIX_FIELD_NAME=value.
- Prefer @EnvVar when env names need to differ from default naming conventions.

## Safe Defaults
- Provide default values in your config classes.
- Use TRV_ENV to switch between development and production profiles.
- Use explicit @EnvVar mappings for secrets and externally managed keys.
