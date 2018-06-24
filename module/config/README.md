travetto: Config 
===
The config module provides support for loading application config on startup. Configuration values support all valid [`yaml`](https://en.wikipedia.org/wiki/YAML) constructs.

## Resolution
Config loading follows a defined resolution path:

1. Load framework module configurations.  Defines general configuration that should be easily overridden.
```bash
node_modules/@travetto/<module>/config/*.yml
```

2. Load local application configurations
```bash
config/*.yml
```

3. Load environment specific configurations as defined by the values in `process.env.ENV`
```properties
process.env.ENV=<val1>,<val2>...
```
would load
```bash
env/<val1>.yml
env/<val2>.yml
```


4. Read startup configuration from `process.env` to allow for overriding any values. Because we are overriding a[`yaml`](https://en.wikipedia.org/wiki/YAML) based configuration we need to compensate for the differences in usage patterns.  Generally all environment variables are passed in as `UPPER_SNAKE_CASE`. When reading from `process.env` we will map `UPPER_SNAKE_CASE` to `upper.snake.case`, and will attempt to match by case-insensitive name.

## Example Resolution

A more complete example setup would look like:

`config/database.yml`
```yaml
database:
  host: localhost
  port: 9423
  creds:
    user: test
    password: test
```

`env/prod.yml`
```yaml
database:
  host: prod-host-db
  creds:
    user: admin-user
```

with environment variables

```properties
ENV=prod
DATABASE_PORT=1234
DATABASE_CREDS_PASSWORD=<secret>
```

At runtime the resolved config would be:
```yaml
database:
  host: prod-host-db
  port: 1234
  creds:
    user: admin-user
    password: <secret>
```

## Reading

The module provides a decorator, `@Config` that allows for classes to automatically be bound with config information on post construction. The decorator will install a `postConstruct` method if not already defined, that allows actually performs the binding of configuration.  

The decorator takes in a namespace, of what part of the resolved configuration you want to bind to your class. Given the following class

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

And the corresponding config file

```yaml
database:
  host: localhost
  port: 9423
  creds:
    user: bob
    password: bobspw
```

The instance of `DBConfig`  would be equivalent to:

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