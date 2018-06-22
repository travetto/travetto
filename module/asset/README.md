travetto: Asset
===

This module provides the framework for storing/retrieving assets. It also provides additional image functionality for on-the-fly resizing. 

`GraphicsMagick` is used under the covers for image transformation.  If the binary is not installed the framework will spin up a `docker` container to provide needed functionality.

The primary driver for the Asset framework is an `AssetSource` which needs to be implemented 
to provide code on how to read and write files.  

```typescript

class Config extends AssetMongoConfig {
  @InjectableFactory()
  static getConf(): AssetMongoConfig {
    return new AssetMongoConfig();
  }
  @InjectableFactory()
  static getSource(cfg: AssetMongoConfig): AssetSource {
    return new AssetMongoSource(cfg);
  }
}

@Injectable()
class AssetService {
  constructor(private source: AssetSource) {}

  async getAsset(path:string) {
    return await this.source.read(path);
  }
}
```

Primary implementations:

- [`Asset-Mongo`](../asset-mongo) provides the mongodb driver for file management
- [`Asset-S3`](../asset-s3) provides the S3 driver for file management