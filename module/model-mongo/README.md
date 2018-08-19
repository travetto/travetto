travetto: Model-Mongo
===

This module provides an [`mongodb`](https://mongodb.com)-based implementation of `ModelSource` for the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module.  This source allows the `Model` module to read, write and query against `elasticserch`. Given the dynamic nature of `mongodb`, during development when models are modified, nothing needs to be done to adapt to the latest schema.

All that is needed to use the `ModelSource` is to register it with the [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di) module.

```typescript
export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelMongoConfig): ModelSource {
    return new ModelMongoSource(conf);
  }
}
```

where the `ModelMongoConfig` is defined by:

```typescript
@Config('model.mongo')
export class ModelMongoConfig {
  hosts = 'localhost';
  namespace = 'app';
  port = 27017;
  options = {};
}
```

and can be overridden via environment variables or config files, as defined in [`Config`](https://github.com/travetto/travetto/tree/master/module/config).

**NOTE** During testing, the source will automatically spin up a `mongodb` server via a `docker` container if you are not already running the service.