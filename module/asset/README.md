<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/asset/doc.ts and execute "npx trv doc" to rebuild -->
# Asset
## Modular library for storing and retrieving binary assets

**Install: @travetto/asset**
```bash
npm install @travetto/asset
```

The asset module requires an [Streaming](https://github.com/travetto/travetto/tree/main/module/model/src/service/stream.ts#L1) to provide functionality for reading and writing streams. You can use any existing providers to serve as your [Streaming](https://github.com/travetto/travetto/tree/main/module/model/src/service/stream.ts#L1), or you can roll your own.

**Install: provider**
```bash
npm install @travetto/model-{provider}
```

Currently, the following are packages that provide [Streaming](https://github.com/travetto/travetto/tree/main/module/model/src/service/stream.ts#L1) support:
   
   *  [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations.") - [FileModelService](https://github.com/travetto/travetto/tree/main/module/model/src/provider/file.ts#L48), [MemoryModelService](https://github.com/travetto/travetto/tree/main/module/model/src/provider/memory.ts#L50)
   *  [MongoDB Model Support](https://github.com/travetto/travetto/tree/main/module/model-mongo#readme "Mongo backing for the travetto model module.")
   *  [S3 Model Support](https://github.com/travetto/travetto/tree/main/module/model-s3#readme "S3 backing for the travetto model module.")

If you are using more than one [Streaming](https://github.com/travetto/travetto/tree/main/module/model/src/service/stream.ts#L1) service, you will need to declare which one is intended to be used by the asset service.  This can be accomplished by:

**Code: Configuration Methods**
```typescript
import { InjectableFactory } from '@travetto/di';
import { S3ModelService } from '@travetto/model-s3';
import { AssetModelⲐ, AssetService } from '@travetto/asset';

class SymoblBasedConfiguration {
  @InjectableFactory(AssetModelⲐ)
  static getAssetModelService(service: S3ModelService) {
    return service;
  }
}

/* OR */

class FullConfiguration {
  @InjectableFactory()
  static getAssetService(service: S3ModelService) {
    return new AssetService(service);
  }
}
```

Reading of and writing assets uses the [AssetService](https://github.com/travetto/travetto/tree/main/module/asset/src/service.ts#L15).  Below you can see an example dealing with a user's profile image.

**Code: User Profile Images**
```typescript
import { ModelCrudSupport } from '@travetto/model';
import { AssetService, Asset } from '@travetto/asset';

import { User } from './user';

export class UserProfileService {

  constructor(
    public asset: AssetService,
    public model: ModelCrudSupport
  ) { }

  async saveProfileImage(userId: string, image: Asset) {
    const path = await this.asset.upsert(image);
    const user = await this.model.get(User, userId);
    user.profileImage = path;
    await this.model.update(User, user);
  }

  async getProfileImage(userId: string) {
    const user = await this.model.get(User, userId);
    return await this.asset.get(user.profileImage);
  }
}
```

## Naming Strategies

By default, the assets are stored by path, as specified in the [Asset](https://github.com/travetto/travetto/tree/main/module/asset/src/types.ts#L8) object.  This is standard, and expected, but some finer control may be desired.  In addition to standard naming, the module also supports naming by hash, to prevent duplicate storage of the same files with different hashes. This is generally useful when surfacing a lot of public (within the application) user-generated content.

The underlying contract for a [AssetNamingStrategy](https://github.com/travetto/travetto/tree/main/module/asset/src/naming.ts#L9) looks like:

**Code: AssetNamingStrategy**
```typescript
export interface AssetNamingStrategy {
  readonly prefix: string;

  /**
   * Produce a path for a given asset
   * @param asset Get path from an asset
   */
  resolve(asset: StreamMeta): string;
}
```

By extending this, and making it [@Injectable](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30), the naming strategy will become the default for the system.  

## Advanced Usage

In addition to reading and writing, you can also retrieve information on the saved asset, including basic information, and additional meta data.  The structure of the [Asset](https://github.com/travetto/travetto/tree/main/module/asset/src/types.ts#L8) looks like:

**Code: Asset Structure**
```typescript
import { StreamMeta } from '@travetto/model';

/**
 * A retrieval/storable asset
 *
 * @concrete ./internal/types:AssetImpl
 */
export interface Asset extends StreamMeta {
  stream: NodeJS.ReadableStream;
}
```

To get the asset information, you would call:

**Code: Fetching Asset Info**
```typescript
import { UserProfileService } from './user-profile';
import { User } from './user';

export class UserProfileTagService extends UserProfileService {
  async getImageContentType(userId: string) {
    const user = await this.model.get(User, userId);
    const info = await this.asset.describe(user.profileImage);

    return info.contentType;  // Return image content type
  }
}
```
