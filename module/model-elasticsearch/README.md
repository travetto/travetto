# Elasticsearch Model Source
## Elasticsearch backing for the travetto model module, with real-time modeling support for Elasticsearch mappings.

**Install: @travetto/model-elasticsearch**
```bash
npm install @travetto/model-elasticsearch
```

This module provides an [elasticsearch](https://elastic.co)-based implementation of [ModelSource](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//model/src/service/source.ts#L58) for the [Data Modeling](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//model "Datastore abstraction for CRUD operations with advanced query support.").  This source allows the [Data Modeling](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//model "Datastore abstraction for CRUD operations with advanced query support.") module to read, write and query against [elasticsearch](https://elastic.co). In development mode, the [ModelSource](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//model/src/service/source.ts#L58) will also modify the [elasticsearch](https://elastic.co) schema in real time to minimize impact to development.

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the source or config, you can override and register it with the [Dependency Injection](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//di "Dependency registration/management and injection support.") module.

**Code: Wiring up a custom Model Source**
```typescript
import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelConfig } from '@travetto/model-elasticsearch/src/config';
import { ElasticsearchModelSource } from '@travetto/model-elasticsearch/src/source';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: ElasticsearchModelConfig) {
    return new ElasticsearchModelSource(conf);
  }
}
```

where the [ElasticsearchModelConfig](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module/model-elasticsearch/src/config.ts#L9) is defined by:

**Code: Structure of ElasticsearchModelConfig**
```typescript
import { EnvUtil } from '@travetto/boot';
import { Config } from '@travetto/config';
import { EsSchemaConfig } from './internal/types';

/**
 * Elasticsearch model config
 */
@Config('elasticsearch.model')
export class ElasticsearchModelConfig {
  /**
   * List of hosts to support
   */
  hosts = ['127.0.0.1'];
  /**
   * Port to listen on
   */
  port = 9200;
  /**
   * Raw elasticsearch options
   */
  options = {};
  /**
   * Index prefix
   */
  namespace = 'app';
  /**
   * Auto-create, disabled in prod by default
   */
  autoCreate = !EnvUtil.isReadonly();
  /**
   * Base schema config for elasticsearch
   */
  schemaConfig: EsSchemaConfig = {
    caseSensitive: false
  };

  /**
   * Base index create settings
   */
  indexCreate = {
    ['number_of_replicas']: 0,
    ['number_of_shards']: 1
  };

  /**
   * Build final hosts
   */
  postConstruct() {
    console.debug('Constructed', this);
    this.hosts = this.hosts
      .map(x => x.includes(':') ? x : `${x}:${this.port}`)
      .map(x => x.startsWith('http') ? x : `http://${x}`);
  }
}
```

and can be overridden via environment variables or config files, as defined in [Configuration](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//config "Environment-aware config management using yaml files").

## CLI - model:es-schema

The module provides the ability to generate the full [elasticsearch](https://elastic.co) schema from all the various [@Model](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//model/src/registry/decorator.ts#L12)s within the application.  This is useful for being able to generate the appropriate [JSON](https://www.json.org) files to define your schemas in production.

**Terminal: Running schema generate**
```bash
$ travetto travetto model:es-schema --help

Usage:  model:es-schema [options]

Options:
  -a, --app [app]  Application to export, (default: .)
  -h, --help       display help for command
```

