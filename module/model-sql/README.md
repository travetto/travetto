travetto: Model-SQL
===


**Install: SQL provider**
```bash
$ npm install @travetto/model-sql
```

**Install: Specific SQL client**
```bash
$ npm install mysql # Use this for mysql

$ npm install pg # Use this for postgres
```


This module provides a [`SQL`]-based implementation of `ModelSource` for the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module.  This source allows the `Model` module to read, write and query against `SQL` databases. In development mode, the `ModelSource` will also modify the database schema in real time to minimize impact to development.  

The schema generated will not generally map to existing tables as it is attempting to produce a document store like experience on top of
a `SQL` database.  Every table generated will have a `path_id` which determines it's location in the document hierarchy as well as sub tables will have a `parent_path_id` to associate records with the parent values.

The current SQL client support stands at:
* MySQL - 5.7
* Postgres - 11+
* SQL Server - Currently unsupported
* Oracle - Currently unsupported

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the source or config, you can override and register it with the [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di) module.

**Code: Wiring up the SQL Model Source**
```typescript
export class Init {
  @InjectableFactory()
  static getModelSource(conf: SQLModelConfig): ModelSource {
    return new SQLModelSource(conf);
  }
}
```

where the `SQLModelConfig` is defined by:

**Code: Structure of SQLModelConfig**
```typescript
@Config('sql.model')
export class SQLModelConfig {
  hosts = '127.0.0.1';
  port = 3306;
  databse = 'app';
}
```

and can be overridden via environment variables or config files, as defined in [`Config`](https://github.com/travetto/travetto/tree/master/module/config).

**NOTE** During testing, the source will automatically spin up an `MySQL` server via a `docker` container if you are not already running the service.