travetto: Asset
===

This module provides the framework for storing/retrieving assets. 

The asset module requires an [`AssetSource`](./src/service/source.ts) to provide functionality for reading and writing files. The `AssetSource` will need to be configured to be picked up by the `AssetService`

**Code: Registering Asset Source**
```typescript
class AppConfig {
  @InjectableFactory()
  static getSource(): AssetSource {
    return new CustomAssetSource();
  }
}
```

**Install: primary**
```bash
$ npm install @travetto/asset
```

You will need to select one of the available providers to serve as your `AssetSource`.

**Install: secondary**
```bash
$ npm install @travetto/asset-{provider}
```

## Images

Storing of and retrieving assets uses the [`AssetService`](./src/service/asset.ts).  Below you can see an example of storing and retrieving a user's profile image.

**Code: Storing images**
```typescript
@Injectable()
class UserProfileService {

  constructor(
    private asset: AssetService, 
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
    return await this.asset.get(user.profileImage);
  }
}
```