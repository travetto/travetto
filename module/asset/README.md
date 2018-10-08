travetto: Asset
===

This module provides the framework for storing/retrieving assets. It also provides additional image functionality for on-the-fly resizing. 

The asset module requires an [`AssetSource`](./src/service/source.ts) to provide functionality for reading and writing files. The `AssetSource` will need to be configured to be picked up by the `AssetService`

```typescript
class AppConfig {
  @InjectableFactory()
  static getSource(): AssetSource {
    return new CustomAssetSource();
  }
}
```

After that, both [`AssetService`](./src/service/asset.ts) and [`ImageService`](./src/service/image.ts) will rely upon the [`AssetSource`](./src/service/source.ts) to do their work.  Below you can see an example of storing and retrieving a user's profile image.  

## Images

Storing of all assets uses the [`AssetService`](./src/service/asset.ts), but retrieval can either be from [`AssetService`](./src/service/asset.ts) or [`ImageService`](./src/service/image.ts) depending on whether or not you want to perform image optimizations on retrieval. The `ImageService` users [`GraphicsMagick`](http://www.graphicsmagick.org) for image transformation.  If the binary is not installed the framework will spin up a [`docker`](https://www.docker.com/community-edition) container to provide needed functionality.

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

Additionally, the `ImageService` currently supports the ability to resize an image on the fly, while auto orienting.  
