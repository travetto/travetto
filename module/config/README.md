travetto: Config 
===

**Install: primary**
```bash
$ npm install @travetto/config
```

The config module provides support for loading application config on startup. Configuration values support all valid [`yaml`](https://en.wikipedia.org/wiki/YAML) constructs.  The configuration information is comprised of:
* `yaml` files
* environment variables

## Resolution
Config loading follows a defined resolution path, below is the order in increasing specificity:

1. `resources/application.yml` - Load the default `application.yml` if available.
1. `resources/*.yml` - Load profile specific configurations as defined by the values in `process.env.TRV_PROFILE`
1. `resources/{env}.yml` - Load environment specific profile configurations as defined by the values of `process.env.TRV_ENV`.
1. `process.env` - Read startup configuration from environment to allow for overriding any values. Because we are overriding a [`yaml`](https://en.wikipedia.org/wiki/YAML) based configuration we need to compensate for the differences in usage patterns.  Generally all environment variables are passed in as `UPPER_SNAKE_CASE`. When reading from `process.env` we will map `UPPER_SNAKE_CASE` to `upper.snake.case`, and will attempt to match by case-insensitive name.

### A Complete Example

A more complete example setup would look like:

**Config: resources/database.yml**
```yaml
database:
  host: localhost
  port: 9423
  creds:
    user: test
    password: test
```

**Config: resources/prod.yml**
```yaml
database:
  host: prod-host-db
  creds:
    user: admin-user
```

with environment variables

**Config: Environment variables**
```properties
PROFILE=prod
DATABASE_PORT=1234
DATABASE_CREDS_PASSWORD=<secret>
```

At runtime the resolved config would be:

**Config: Runtime resolution**
```yaml
database:
  host: prod-host-db
  port: 1234
  creds:
    user: admin-user
    password: <secret>
```

## Consuming

The `ConfigManager` service provides direct access to all of the loaded configuration. For simplicity, a decorator, `@Config` allows for classes to automatically be bound with config information on post construction. The decorator will install a `postConstruct` method if not already defined, that performs the binding of configuration.  This is due to the fact that we cannot rewrite the constructor, and order of operation matters.

The decorator takes in a namespace, of what part of the resolved configuration you want to bind to your class. Given the following class:

**Code: Database config object**
```typescript
@Config('database')
class DBConfig {
  private host: string;
  private port: number;
  private creds = {
    user: '',
    password: ''
  };
}
```

And the corresponding config file:

**Config: Database config via yaml**
```yaml
database:
  host: localhost
  port: 9423
  creds:
    user: bob
    password: bobspw
```

The instance of `DBConfig`  would be equivalent to:

**Config: Resolved database config as JSON**
```js
{
  host: 'localhost',
  port: 9423,
  creds : {
    user: 'bob',
    password: 'bobspw'
  }
}
```