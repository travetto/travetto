travetto: Model-Elasticsearch
===

This module provides an [`elasticsearch`](https://elastic.co)-based implementation of `ModelSource` for the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module.  This source allows the `Model` module to read, write and query against `elasticserch`. In development mode, the `ModelSource` will also modify the `elasticsearch` schema in real time to minimize impact to development.  

All that is needed to use the `ModelSource` is to register it with the [`Dependency Injection`](https://github.com/travetto/di) module.

```typescript
export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelElasticsearchConfig): ModelSource {
    return new ModelElasticsearchSource(conf);
  }
}
```

where the `ModelElasticsearchConfig` is defined by:

```typescript
@Config('model.elasticsearch')
export class ModelElasticsearchConfig {
  hosts = ['127.0.0.1'];
  port = 9200;
  options = {};
  namespace = 'app';
}
```

and can be overridden via environment variables or config files, as defined in [`Config`](https://github.com/travetto/travetto/tree/master/module/config).

**NOTE** During testing, the source will automatically spin up an `elasticsearch` server via a `docker` container if you are not already running the service.