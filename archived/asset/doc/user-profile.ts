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