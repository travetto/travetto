# Asset
## Modular library for storing and retrieving binary assets

**Install: @travetto/asset**
```bash
npm install @travetto/asset
```

The asset module requires an [AssetSource](https://github.com/travetto/travetto/tree/1.0.0-dev/module/asset/src/source.ts#L6) to provide functionality for reading and writing files. You will need to select one of the available providers to serve as your [AssetSource](https://github.com/travetto/travetto/tree/1.0.0-dev/module/asset/src/source.ts#L6).

**Install: provider**
```bash
npm install @travetto/asset-{provider}
```

Reading of and writing assets uses the [AssetService](https://github.com/travetto/travetto/tree/1.0.0-dev/module/asset/src/service.ts#L14).  Below you can see an example dealing with a user's profile image.

**Code: User Profile Images**
```typescript
import { ModelService } from '@travetto/model';
import { AssetService } from '@travetto/asset/src/service';
import { Asset } from '@travetto/asset/src/types';
import { User } from '../user';

export class UserProfileService {

  constructor(
    public asset: AssetService,
    public model: ModelService
  ) { }

  async saveProfileImage(userId: string, image: Asset) {
    const path = await this.asset.write(image);
    const user = await this.model.getById(User, userId);
    user.profileImage = path;
    await this.model.update(User, user);
  }

  async getProfileImage(userId: string) {
    const user = await this.model.getById(userId);
    return await this.asset.read(user.profileImage);
  }
}
```

## Naming Strategies

By default, the assets are stored by path, as specified in the [Asset](./src/types.ts#L5) object.  This is standard, and expected, but some finer control may be desired.  In addition to standard naming, the module also supports naming by hash, to prevent duplicate storage of the same files with different hashes. This is generally useful when surfacing a lot of public (within the application) user-generated content.

The underlying contract for a [AssetNamingStrategy](https://github.com/travetto/travetto/tree/1.0.0-dev/module/asset/src/naming.ts#L8) looks like:

**Code: Asset Naming Strategy**
```typescript
export abstract class AssetNamingStrategy {
  public readonly prefix: string;
  /**
   * Produce a path for a given asset
   * @param Asset Get path from an asset
   */
  abstract getPath(Asset: Asset): string;
}
```

By extending this, and making it [@Injectable](https://github.com/travetto/travetto/tree/1.0.0-dev/module/di/src/decorator.ts#L29), the naming strategy will become the default for the system.  

## Advanced Usage

In addition to reading and writing, you can also retrieve information on the saved asset, including basic information, and additional meta data.  The structure of the [Asset](./src/types.ts#L5) looks like:

**Code: Asset Structure**
```typescript
/**
 * A retrieval/storable asset
 *
 * @concrete ./internal/types:AssetImpl
 */
export interface Asset {
  /**
   * Stream of the asset contents
   */
  stream: NodeJS.ReadableStream;
  /**
   * Size in bytes
   */
  size: number;
  /**
   * Path within the remote store
   */
  path: string;
  /**
   * Mime type of the content
   */
  contentType: string;
  /**
   * Supplemental information
   */
  metadata: {
    /**
     * The filename of the asset
     */
    name: string;
    /**
     * A readable title of the asset
     */
    title: string;
    /**
     * Hash of the file contents.  Different files with the same name, will have the same hash
     */
    hash: string;
    /**
     * Date of creation
     */
    createdDate: Date;
    /**
     * Optional tags, can be used for access control
     */
    tags?: string[];
  };
}
```

To get the asset information, you would call:

**Code: Fetching Asset Info**
```typescript
import { UserProfileService } from './user-profile';

export class UserProfileTagService extends UserProfileService {
  async checkImageGroup(userId: string) {
    const user = await this.model.getById(userId);
    const info = await this.asset.info(user.profileImage);

    // Check asset's tags for a specific group
    return info.metadata?.tags?.includes(user.group);
  }
}
```

