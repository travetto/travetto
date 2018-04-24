travetto: Config 
===

Common functionality for reading configuration from yaml files, and allowing overriding at execution time
  - Process all config information:
    - `node_modules/@travetto/*/config/*.yml`
    - `config/*.yml`
    - `env/<env>.yml`
    - `process.env` (override only)
  - Depending on which environments are specified, will selectively load `env/<env>.yml` files
  - Every configuration property can be overridden via environment variables (case-insensitive).
     - Object navigation is separated by underscores
     - e.g. `MAIL_TRANSPORT_HOST` would override `mail.transport.host` and specifically `transport.host`
       in the `mail` namespace.

Provides a decorator, `@Config("namespace")` that allows for classes to automatically bind config information
on post construct. The decorator will install a `postConstruct` method if not already defined.  This is a hook
that is used by other modules.

```typescript config.ts
@Config('sample')
class SampleConfig {
  private host: string;
  private port: number;
  private creds = {
    user: '',
    password: ''
  };
}
```

And the corresponding config file

```yaml app.yml
- sample
  host: google.com
  port: 80
  creds:
    user: bob
    password: bobspw
```
