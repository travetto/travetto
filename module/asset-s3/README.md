travetto: Asset-S3
===

This provides an [`s3`](https://aws.amazon.com/documentation/s3/) implementation of the `AssetSource` that which is a backend for the [`Asset`](https://github.com/travetto/travetto/tree/master/module/asset) module.  

```typescript
class AppConfig {
  @InjectableFactory()
  static getSource(cfg: AssetS3Config): AssetSource {
    return new AssetS3Source(cfg);
  }
}
```

There is a default configuration that you can easily use, with some sensible defaults.

```typescript
@Config('asset.s3')
export class AssetS3Config {
  region = 'us-east-1';
  base = '';

  accessKeyId = '';
  secretAccessKey = '';

  bucket = '';

  config: aws.S3.ClientConfiguration;
  ...
}
```

**NOTE** Do not commit your `accessKeyId` or `secretAccessKey` values to your source repository, especially if it is public facing.  Not only is it a security risk, but Amazon will scan public repos, looking for keys, and if found will react swiftly.

Additionally, you can see that the class is registered with the `@Config` decorator, and so these values can be overridden using the standard[`Configuration`](https://github.com/travetto/travetto/tree/master/module/config) resolution paths.