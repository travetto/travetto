travetto: Asset
===

This module provides the framework for storing/retrieving assets. 

The asset module requires an [`AssetSource`](./src/service/source.ts) to provide functionality for reading and writing files. 

**Install: primary**
```bash
$ npm install @travetto/asset
```

You will need to select one of the available providers to serve as your `AssetSource`.

**Install: secondary**
```bash
$ npm install @travetto/asset-{provider}
```

Reading of and writing assets uses the [`AssetService`](./src/service/asset.ts).  Below you can see an example dealing with a user's profile image.

**Code: User Profile Images**
```typescript
@Injectable()
class UserProfileService {

  constructor(
    private asset: AssetService, 
    private model: ModelService
  ) {}

  async saveProfileImage(userId: string, image: Asset) {
    const path = await this.asset.write(image);
    const user = await this.model.getById(User, userId);
    user.profileImage = path;
    await this.model.update(User, user);
  }

  async getProfileImage(userId:string) {
    const user = await this.model.getById(userId);
    return await this.asset.read(user.profileImage);
  }
}
```

## Naming Strategies
By default, the assets are stored by path, as specified in the [`Asset`](./src/types.ts) object.  This is standard, and expected, but some finer control may be desired.  In addition to standard naming, the module also supports naming by hash, to prevent duplicate storage of the same files with different hashes. This is generally useful when surfacing a lot of public (within the application) user-generated content.

The underlying contract for a [`AssetNamingStrategy`](./src/naming.ts) looks like:

**Code: AssetNamingStrategy**
```typescript
class AssetNamingStrategy {
  getPath(Asset: Asset): string;
}
```

By extending this, and making it `@Injectable`, the naming strategy will become the default for the system.  

## Advanced Usage
In addition to reading and writing, you can also retrieve information on the saved asset, including basic information, and additional meta data.  The structure of the [`Asset`](./src/types.ts) looks like:

**Code: Asset Structure**
```typescript
export interface Asset {
  stream: NodeJS.ReadableStream; // This will not be provided on the request for information only
  size: number;
  path: string; // Path in remote service
  contentType: string;
    metadata: {
    name: string;
    title: string;
    hash: string;
    createdDate: Date;
    tags?: string[]; // Tags for defining additional information on the asset
  };
}

```

To get the asset information, you would call:

**Code: Fetching Asset Info**
```typescript 
  async checkImageGroup(userId:string) {
    const user = await this.model.getById(userId);
    const info = await this.asset.info(user.profileImage);

    // Check asset's tags for a specific group
    return info.metadata?.tags.includes(user.group);
  }
```