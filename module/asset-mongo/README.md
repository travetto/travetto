travetto: Asset-Mongo
===

**Install: mongo provider**
```bash
$ npm install @travetto/asset-mongo
```

This provides a [`mongodb`](https://mongodb.com) implementation of the `AssetSource` which is a backend for the [`Asset`](https://github.com/travetto/travetto/tree/master/module/asset) module.  

**Code: Mongo backend wiring**
```typescript
class AppConfig {
  @InjectableFactory()
  static getSource(cfg: MongoAssetConfig): AssetSource {
    return new MongoAssetSource(cfg);
  }
}
```

There is a default configuration that you can easily use, with some sensible defaults. 

**Code: Mongo configuration**
```typescript
@Config('mongo.asset')
export class MongoAssetConfig {
  hosts = 'localhost';
  schema = 'app';
  port = 27017;
  options = {};
  ...
}
```

Additionally, you can see that the class is registered with the `@Config` annotation, and so these values can be overridden using the standard[`Configuration`](https://github.com/travetto/travetto/tree/master/module/config) resolution paths. 
