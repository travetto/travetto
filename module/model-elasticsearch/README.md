travetto: Model-Elasticsearch
===


**Install: Elasticsearch provider**
```bash
$ npm install @travetto/model-elasticsearch
```


This module provides an [`elasticsearch`](https://elastic.co)-based implementation of `ModelSource` for the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module.  This source allows the `Model` module to read, write and query against `elasticsearch`. In development mode, the `ModelSource` will also modify the `elasticsearch` schema in real time to minimize impact to development.  

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the source or config, you can override and register it with the [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di) module.

**Code: Wiring up the Elasticsearch Model Source**
```typescript
export class Init {
  @InjectableFactory()
  static getModelSource(conf: ElasticsearchModelConfig): ModelSource {
    return new ElasticsearchModelSource(conf);
  }
}
```

where the `ElasticsearchModelConfig` is defined by:

**Code: Structure of ElasticsearchModelConfig**
```typescript
@Config('model.elasticsearch')
export class ElasticsearchModelConfig {
  hosts = ['127.0.0.1'];
  port = 9200;
  options = {};
  namespace = 'app';
  indexCreate = {
    ...
  }
}
```

and can be overridden via environment variables or config files, as defined in [`Config`](https://github.com/travetto/travetto/tree/master/module/config).

**NOTE** During testing, the source will automatically spin up an `elasticsearch` server via a `docker` container if you are not already running the service.