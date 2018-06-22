travetto: Asset-S3
===

This provides an `s3` implementation of the `AssetSource` that which is a backend for the [`Asset`](https://github.io/travetto/asset) module.  

The primary utilization of this module, is to configure the `AssetSource` injectable, and provide whatever configuration you would like to use.  

```typescript
class AppConfig {
  @InjectableFactory()
  static getConf(): AssetS3Config {
    return new AssetS3Config();
  }
  @InjectableFactory()
  static getSource(cfg: AssetS3Config): AssetSource {
    return new AssetS3Source(cfg);
  }
}
```

As seen, there is a default configuration that you can easily use, with some sensible defaults.

The default configuration class looks like:

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

**NOTE** Do not commit your `accessKeyId` or `secretAccessKey` values to your source repository, especially if it is public facing.  Not only is 
it a security risk, but Amazon will scan public repos, looking for keys, and if found will react swiftly.

Additionally, you can see that the class is registered with the `Config` annotation, and so these values can be overridden using the standard
[`Configuration`](https://github.com/travetto/config) resolution paths.