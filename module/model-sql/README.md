travetto: Model-Sql
===

This module provides a [`sequelize`](http://docs.sequelizejs.com/)-based implementation of `ModelSource` for the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module.  This source allows the `Model` module to read, write and query against `sql`. In development mode, the `ModelSource` will also modify the `sql` schema in real time to minimize impact to development.  

All that is needed to use the `ModelSource` is to register it with the [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di) module.

```typescript
export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelSqlConfig): ModelSource {
    return new ModelSqlSource(conf);
  }
}
```

where the `ModelSqlConfig` is defined by:

```typescript
@Config('model.sql')
export class ModelSqlConfig {
  hosts = '127.0.0.1';
  port = 3306;
  dialect = 'mysql';
  options = {};
  namespace = 'app';
}
```

and can be overridden via environment variables or config files, as defined in [`Config`](https://github.com/travetto/travetto/tree/master/module/config).

**NOTE** During testing, the source will automatically spin up an `mysql` server via a `docker` container if you are not already running the service.