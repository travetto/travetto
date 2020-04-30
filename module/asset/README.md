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

Storing of and retrieving assets uses the [`AssetService`](./src/service/asset.ts).  Below you can see an example of storing and retrieving a user's profile image.

**Code: Storing Profile Images**
```typescript
@Injectable()
class UserProfileService {

  constructor(
    private asset: AssetService, 
    private model: ModelService
  ) {}

  async saveProfileImage(userId: string, image: Asset) {
    const path = await this.asset.set(image);
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

## Naming Strategies
By default, the assets are stored by path, as specified in the [`Asset`](./src/types.ts) object.  This is standard, and expected, but some finer control may be desired.  In addition to standard naming, the module also supports naming by hash, to prevent duplicate storage of the same files with different hashes. This is generally useful when surfacing a lot of public (within the application) user-generated content.

The underlying contract for a [`AssetNamingStrategy`](./src/strategy.ts) looks like:

**Code: AssetNamingStrategy**
```typescript
class AssetNamingStrategy {
  getPath(Asset: Asset): string;
}
```

By extending this, and making it `@Injectable`, the naming strategy will become the default for the system.  