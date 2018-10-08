travetto: Asset-Mongo
===

This provides a [`mongodb`](https://mongodb.com) implementation of the `AssetSource` which is a backend for the [`Asset`](https://github.com/travetto/travetto/tree/master/module/asset) module.  

```typescript
class AppConfig {
  @InjectableFactory()
  static getSource(cfg: AssetMongoConfig): AssetSource {
    return new AssetMongoSource(cfg);
  }
}
```

There is a default configuration that you can easily use, with some sensible defaults. 

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

Additionally, you can see that the class is registered with the `@Config` annotation, and so these values can be overridden using the standard[`Configuration`](https://github.com/travetto/travetto/tree/master/module/config) resolution paths. 
