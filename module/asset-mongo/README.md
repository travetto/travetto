travetto: Asset-Mongo
===

This provides a [`mongodb`](https://mongodb.com) implementation of the `AssetSource` that which is a backend for the [`Asset`](https://github.com/travetto/asset) module.  

The primary utilization of this module, is to configure the `AssetSource` injectable, and provide whatever configuration you would like to use.  

```typescript
class AppConfig {
  @InjectableFactory()
  static getConf(): AssetMongoConfig {
    return new AssetMongoConfig();
  }
  @InjectableFactory()
  static getSource(cfg: AssetMongoConfig): AssetSource {
    return new AssetMongoSource(cfg);
  }
}
```

As seen, there is a default configuration that you can easily use, with some sensible defaults.

The default configuration class looks like:

```typescript
@Config('asset.mongo')
export class AssetMongoConfig {
  hosts = 'localhost';
  schema = 'app';
  port = 27017;
  options = {};
  ...
}
```

Additionally, you can see that the class is registered with the `@Config` annotation, and so these values can be overridden using the standard[`Configuration`](https://github.com/travetto/config) resolution paths. 
