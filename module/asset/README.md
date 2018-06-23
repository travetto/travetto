travetto: Asset
===

This module provides the framework for storing/retrieving assets. It also provides additional image functionality for on-the-fly resizing. 

[`GraphicsMagick`](http://www.graphicsmagick.org) is used under the covers for image transformation.  If the binary is not installed the framework will spin up a [`docker`](https://www.docker.com/community-edition) container to provide needed functionality.

The primary driver for the Asset framework is an [`AssetSource`](./src/service/source.ts) which needs to be implemented 
to provide code on how to read and write files.  

Initially you need to configure the [`AssetSource`](./src/service/source.ts) to provide a backend for the storage and retrieval. Below we are using the [`Asset-Mongo`](https://github.com/travetto/asset-mongo) as the
backend, but there are others to choose from.

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

After that, both [`AssetService`](./src/service/asset.ts) and [`ImageService`](./src/service/image.ts) 
will rely upon the [`AssetSource`](./src/service/source.ts) to do their work.  Below you can see an example of storing and retrieving a user's profile image.  
Storing of all assets goes through the [`AssetService`](./src/service/asset.ts), but retrieval can either 
be from [`AssetService`](./src/service/asset.ts) or [`ImageService`](./src/service/image.ts) depending on whether or not you want to perform
image optimizations on retrieval.

```typescript
@Injectable()
class UserProfileService {

  constructor(
    private asset: AssetService, 
    private image: ImageService,
    private model: ModelService
  ) {}

  async saveProfileImage(userId: string, image: Asset) {
    const path = await this.asset.store(image);
    const user = await this.model.getById(User, userId);
    user.profileImage = path;
    await this.model.update(User, user);
  }

  async getProfileImage(userId:string) {
    const user = await this.model.getById(userId);
    return await this.image.getImage(user.profileImage, { w: 100, h: 100 });
  }
}
```

The current set of supported [`AssetSource`](./src/service/source.ts) implementations are:

- [`Asset-Mongo`](https://github.com/travetto/asset-mongo#readme) provides the mongodb driver for file management
- [`Asset-S3`](https://github.com/travetto/asset-s3#readme) provides the S3 driver for file management


